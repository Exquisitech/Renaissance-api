import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { Bet, BetStatus } from './entities/bet.entity';
import {
  Match,
  MatchStatus,
  MatchOutcome,
} from '../matches/entities/match.entity';
import { CreateBetDto } from './dto/create-bet.dto';
import { UpdateBetStatusDto } from './dto/update-bet-status.dto';
import { WalletService } from '../wallet/wallet.service';
import { FreeBetVoucherService } from '../free-bet-vouchers/free-bet-vouchers.service';
import { TransactionSource } from '../wallet/entities/balance-transaction.entity';
import { BetPlacedEvent } from '../leaderboard/domain/events/bet-placed.event';
import { BetSettledEvent } from '../leaderboard/domain/events/bet-settled.event';
import { RateLimitInteractionService } from '../rate-limit/rate-limit-interaction.service';

export interface PaginatedBets {
  data: Bet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BetSettlementSummary {
  settled: number;
  won: number;
  lost: number;
  totalPayout: number;
}

export interface SettlementExecutionOptions {
  batchSize?: number;
}

@Injectable()
export class BetsService {
  constructor(
    @InjectRepository(Bet)
    private readonly betRepository: Repository<Bet>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly eventBus: EventBus,
    private readonly freeBetVoucherService: FreeBetVoucherService,
    private readonly rateLimitService: RateLimitInteractionService,
  ) {}

  /**
   * Place a bet on a match
   * Uses transaction to ensure atomic operations between wallet deduction and bet creation
   */
  async placeBet(userId: string, createBetDto: CreateBetDto): Promise<Bet> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the match with lock to prevent race conditions
      const match = await queryRunner.manager.findOne(Match, {
        where: { id: createBetDto.matchId },
        lock: { mode: 'pessimistic_read' },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      // Validate match status - bets can only be placed on upcoming matches
      if (match.status !== MatchStatus.UPCOMING) {
        throw new BadRequestException(
          `Cannot place bet: Match is ${match.status}. Bets can only be placed on upcoming matches.`,
        );
      }

      // Check if user already has a bet on this match
      const existingBet = await queryRunner.manager.findOne(Bet, {
        where: { userId, matchId: createBetDto.matchId },
      });

      if (existingBet) {
        throw new ConflictException(
          'You have already placed a bet on this match',
        );
      }

      // Resolve free bet voucher if provided. Vouchers: non-withdrawable, betting only, auto-consumed on use.
      let useVoucher = false;
      let voucherId: string | undefined;
      let voucherIsWithdrawable = false;
      if (createBetDto.voucherId) {
        const voucher = await this.freeBetVoucherService.validateVoucher(
          createBetDto.voucherId,
          userId,
        );
        const vAmount = Number(voucher.amount);
        if (Number(createBetDto.stakeAmount) !== vAmount) {
          throw new BadRequestException(
            `Stake amount must equal voucher amount (${vAmount}) when using a free bet voucher`,
          );
        }
        useVoucher = true;
        voucherId = createBetDto.voucherId;
        voucherIsWithdrawable = Boolean(voucher.metadata?.isWithdrawable);
      }

      // Deduct from wallet only when not using a voucher (vouchers cannot be withdrawn)
      if (!useVoucher) {
        try {
          await this.walletService.debit(
            userId,
            Number(createBetDto.stakeAmount),
            TransactionSource.BET,
            uuidv4(),
            {
              reason: 'BET_PLACEMENT',
              matchId: createBetDto.matchId,
              predictedOutcome: createBetDto.predictedOutcome,
            },
          );
        } catch (error) {
          throw new BadRequestException(
            error.message || 'Failed to deduct stake amount from wallet',
          );
        }
      }

      // Calculate odds and potential payout
      const odds = this.getOddsForOutcome(match, createBetDto.predictedOutcome);
      const potentialPayout = Number(createBetDto.stakeAmount) * Number(odds);

      // Create the bet
      const bet = queryRunner.manager.create(Bet, {
        userId,
        matchId: createBetDto.matchId,
        stakeAmount: createBetDto.stakeAmount,
        predictedOutcome: createBetDto.predictedOutcome,
        odds,
        potentialPayout,
        status: BetStatus.PENDING,
        metadata: useVoucher
          ? {
              voucherId,
              isFreeBet: true,
              isVoucherWithdrawable: voucherIsWithdrawable,
            }
          : undefined,
      });

      const savedBet = await queryRunner.manager.save(bet);

      // Automatically consume voucher on use
      if (useVoucher && voucherId) {
        await this.freeBetVoucherService.consumeVoucherWithManager(
          queryRunner.manager,
          voucherId,
          userId,
          savedBet.id,
        );
      }

      // Link wallet transaction to bet (only when wallet was used)
      // Note: The new WalletService might not expose easy access to the last transaction entity directly in the same way,
      // but we passed metadata. If we need to link explicitly, we might need to adjust WalletService.
      // For now, skipping explicit linking as WalletService handles its own transaction logs.

      await queryRunner.commitTransaction();

      // Emit BetPlacedEvent for leaderboard updates
      this.eventBus.publish(
        new BetPlacedEvent(
          userId,
          createBetDto.matchId,
          Number(createBetDto.stakeAmount),
          createBetDto.predictedOutcome,
        ),
      );

      await this.rateLimitService.recordInteraction(userId);

      return savedBet;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get odds for a specific outcome from match
   */
  private getOddsForOutcome(match: Match, outcome: MatchOutcome): number {
    switch (outcome) {
      case MatchOutcome.HOME_WIN:
        return Number(match.homeOdds);
      case MatchOutcome.AWAY_WIN:
        return Number(match.awayOdds);
      case MatchOutcome.DRAW:
        return Number(match.drawOdds);
      default:
        throw new BadRequestException('Invalid outcome');
    }
  }

  /**
   * Get all bets for a user with pagination
   */
  async getUserBets(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedBets> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.betRepository.findAndCount({
      where: { userId },
      relations: ['match'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all bets for a specific match with pagination
   * Optimized to use QueryBuilder for better control over selected fields
   */
  async getMatchBets(
    matchId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedBets> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const skip = (page - 1) * limit;

    // Use QueryBuilder to select only necessary user fields
    const queryBuilder = this.betRepository
      .createQueryBuilder('bet')
      .leftJoinAndSelect('bet.user', 'user')
      .select([
        'bet',
        'user.id',
        'user.email',
        'user.username',
        'user.firstName',
        'user.lastName',
        'user.avatar',
      ])
      .where('bet.matchId = :matchId', { matchId })
      .orderBy('bet.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific bet by ID
   */
  async getBetById(betId: string, userId?: string): Promise<Bet> {
    const bet = await this.betRepository.findOne({
      where: { id: betId },
      relations: ['match', 'user'],
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    // If userId is provided, verify ownership
    if (userId && bet.userId !== userId) {
      throw new ForbiddenException('You do not have access to this bet');
    }

    return bet;
  }

  /**
   * Update bet status (admin only)
   * Validates state transitions
   */
  async updateBetStatus(
    betId: string,
    updateBetStatusDto: UpdateBetStatusDto,
  ): Promise<Bet> {
    const bet = await this.betRepository.findOne({
      where: { id: betId },
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    // Validate state transition
    this.validateStatusTransition(bet.status, updateBetStatusDto.status);

    // Update the bet
    bet.status = updateBetStatusDto.status;

    if (
      updateBetStatusDto.status === BetStatus.WON ||
      updateBetStatusDto.status === BetStatus.LOST ||
      updateBetStatusDto.status === BetStatus.CANCELLED
    ) {
      bet.settledAt = new Date();
    }

    const savedBet = await this.betRepository.save(bet);

    // Update leaderboard stats asynchronously via event
    // Note: Assuming we want to treat manual updates similar to settlement
    // We construct a settlement event
    const isWin = savedBet.status === BetStatus.WON;
    if (
      savedBet.status === BetStatus.WON ||
      savedBet.status === BetStatus.LOST
    ) {
      this.eventBus.publish(
        new BetSettledEvent(
          savedBet.userId,
          savedBet.id,
          savedBet.matchId,
          isWin,
          Number(savedBet.stakeAmount),
          isWin ? Number(savedBet.potentialPayout) : 0,
          0, // Accuracy calculated by handler
        ),
      );
    }

    return savedBet;
  }

  /**
   * Settle all bets for a match based on the match outcome
   * Winning bets are always processed before losing bets so retries can safely
   * resume from the remaining pending set.
   */
  async settleMatchBets(
    matchId: string,
    options: SettlementExecutionOptions = {},
  ): Promise<BetSettlementSummary> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.status !== MatchStatus.FINISHED) {
      throw new BadRequestException('Cannot settle bets: Match is not finished');
    }

    if (!match.outcome) {
      throw new BadRequestException('Cannot settle bets: Match outcome not set');
    }

    const batchSize = Math.max(1, Math.min(options.batchSize ?? 200, 500));

    const winnersSummary = await this.processSettlementBatches(
      match,
      batchSize,
      true,
    );
    const losersSummary = await this.processSettlementBatches(
      match,
      batchSize,
      false,
    );

    return {
      settled: winnersSummary.settled + losersSummary.settled,
      won: winnersSummary.won + losersSummary.won,
      lost: winnersSummary.lost + losersSummary.lost,
      totalPayout: winnersSummary.totalPayout + losersSummary.totalPayout,
    };
  }

  /**
   * Cancel a bet (only if still pending)
   * Refunds the stake amount to user wallet
   */
  async cancelBet(
    betId: string,
    userId: string,
    isAdmin: boolean = false,
  ): Promise<Bet> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bet = await queryRunner.manager.findOne(Bet, {
        where: { id: betId },
      });

      if (!bet) {
        throw new NotFoundException('Bet not found');
      }

      // Check ownership if not admin
      if (!isAdmin && bet.userId !== userId) {
        throw new ForbiddenException('You do not have access to this bet');
      }

      if (bet.status !== BetStatus.PENDING) {
        throw new ConflictException(
          'Cannot cancel bet: Bet has already been settled',
        );
      }

      // Refund stake amount to user wallet
      const isFreeBet = Boolean(bet.metadata?.isFreeBet);
      const isVoucherWithdrawable = Boolean(
        bet.metadata?.isVoucherWithdrawable,
      );
      const voucherId = bet.metadata?.voucherId as string | undefined;

      if (isFreeBet && voucherId && !isVoucherWithdrawable) {
        await this.freeBetVoucherService.restoreVoucherWithManager(
          queryRunner.manager,
          voucherId,
          bet.userId,
          bet.id,
        );
      } else {
        await this.walletService.credit(
          bet.userId,
          Number(bet.stakeAmount),
          TransactionSource.BET,
          uuidv4(),
          {
            reason: 'BET_CANCELLATION',
            betId: bet.id,
            matchId: bet.matchId,
            stakeAmount: Number(bet.stakeAmount),
            cancellationReason: isAdmin ? 'admin_cancelled' : 'user_cancelled',
            isFreeBet,
            isVoucherWithdrawable,
          },
        );
      }

      bet.status = BetStatus.CANCELLED;
      bet.settledAt = new Date();

      const savedBet = await queryRunner.manager.save(bet);

      await queryRunner.commitTransaction();

      return savedBet;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async processSettlementBatches(
    match: Match,
    batchSize: number,
    winnersOnly: boolean,
  ): Promise<BetSettlementSummary> {
    const summary: BetSettlementSummary = {
      settled: 0,
      won: 0,
      lost: 0,
      totalPayout: 0,
    };

    while (true) {
      const batch = await this.loadPendingSettlementBatch(
        match.id,
        match.outcome,
        batchSize,
        winnersOnly,
      );

      if (batch.length === 0) {
        break;
      }

      const batchSummary = await this.settleBetBatch(match, batch, winnersOnly);
      summary.settled += batchSummary.settled;
      summary.won += batchSummary.won;
      summary.lost += batchSummary.lost;
      summary.totalPayout += batchSummary.totalPayout;
    }

    return summary;
  }

  private async loadPendingSettlementBatch(
    matchId: string,
    matchOutcome: MatchOutcome,
    batchSize: number,
    winnersOnly: boolean,
  ): Promise<Bet[]> {
    const queryBuilder = this.betRepository
      .createQueryBuilder('bet')
      .where('bet.matchId = :matchId', { matchId })
      .andWhere('bet.status = :status', { status: BetStatus.PENDING })
      .orderBy('bet.createdAt', 'ASC')
      .take(batchSize);

    if (winnersOnly) {
      queryBuilder.andWhere('bet.predictedOutcome = :outcome', {
        outcome: matchOutcome,
      });
    } else {
      queryBuilder.andWhere('bet.predictedOutcome <> :outcome', {
        outcome: matchOutcome,
      });
    }

    return queryBuilder.getMany();
  }

  private async settleBetBatch(
    match: Match,
    pendingBatch: Bet[],
    winnersOnly: boolean,
  ): Promise<BetSettlementSummary> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedBets = await queryRunner.manager.find(Bet, {
        where: {
          id: In(pendingBatch.map((bet) => bet.id)),
          status: BetStatus.PENDING,
        },
        lock: { mode: 'pessimistic_write' },
      });

      const orderedBets = pendingBatch
        .map((bet) => lockedBets.find((lockedBet) => lockedBet.id === bet.id))
        .filter((bet): bet is Bet => Boolean(bet));

      const summary: BetSettlementSummary = {
        settled: 0,
        won: 0,
        lost: 0,
        totalPayout: 0,
      };
      const settledBetEvents: BetSettledEvent[] = [];

      for (const bet of orderedBets) {
        const isWin = bet.predictedOutcome === match.outcome;
        if ((winnersOnly && !isWin) || (!winnersOnly && isWin)) {
          continue;
        }

        let winningsAmount = 0;
        if (isWin) {
          bet.status = BetStatus.WON;
          summary.won += 1;
          const isFreeBet = Boolean(bet.metadata?.isFreeBet);
          const isVoucherWithdrawable = Boolean(
            bet.metadata?.isVoucherWithdrawable,
          );

          if (isFreeBet && !isVoucherWithdrawable) {
            winningsAmount = Math.max(
              0,
              Number(bet.potentialPayout) - Number(bet.stakeAmount),
            );
          } else {
            winningsAmount = Number(bet.potentialPayout);
          }

          if (winningsAmount > 0) {
            const balanceResult =
              await this.walletService.updateUserBalanceWithQueryRunner(
                queryRunner,
                bet.userId,
                winningsAmount,
                'BET_SETTLEMENT',
                bet.id,
                {
                  reason: 'BET_WINNING',
                  matchId: bet.matchId,
                  stakeAmount: Number(bet.stakeAmount),
                  payoutAmount: winningsAmount,
                  betId: bet.id,
                  isFreeBet,
                  isVoucherWithdrawable,
                },
                !isFreeBet || isVoucherWithdrawable,
              );

            if (!balanceResult.success) {
              throw new BadRequestException(
                balanceResult.error ||
                  `Failed to credit winnings for bet ${bet.id}`,
              );
            }
          }

          summary.totalPayout += winningsAmount;
        } else {
          bet.status = BetStatus.LOST;
          summary.lost += 1;
        }

        bet.settledAt = new Date();
        await queryRunner.manager.save(Bet, bet);
        summary.settled += 1;
        settledBetEvents.push(
          new BetSettledEvent(
            bet.userId,
            bet.id,
            match.id,
            isWin,
            Number(bet.stakeAmount),
            winningsAmount,
            0,
          ),
        );
      }

      await queryRunner.commitTransaction();
      settledBetEvents.forEach((event) => this.eventBus.publish(event));
      return summary;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate bet status transitions
   * PENDING → WON | LOST | CANCELLED (once settled, immutable)
   */
  private validateStatusTransition(
    currentStatus: BetStatus,
    newStatus: BetStatus,
  ): void {
    // If already settled, no further transitions allowed
    if (currentStatus !== BetStatus.PENDING) {
      throw new ConflictException(
        `Cannot change bet status: Bet has already been settled as ${currentStatus}`,
      );
    }

    // From PENDING, can only go to WON, LOST, or CANCELLED
    const validTransitions: BetStatus[] = [
      BetStatus.WON,
      BetStatus.LOST,
      BetStatus.CANCELLED,
    ];

    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Get betting statistics for a user
   * Optimized to use database aggregation instead of loading all bets into memory
   */
  async getUserBettingStats(userId: string): Promise<{
    totalBets: number;
    pendingBets: number;
    wonBets: number;
    lostBets: number;
    cancelledBets: number;
    totalStaked: number;
    totalWon: number;
    winRate: number;
  }> {
    // Use QueryBuilder for efficient aggregation
    const stats = await this.betRepository
      .createQueryBuilder('bet')
      .select('COUNT(*)', 'totalBets')
      .addSelect(
        "SUM(CASE WHEN bet.status = 'pending' THEN 1 ELSE 0 END)",
        'pendingBets',
      )
      .addSelect(
        "SUM(CASE WHEN bet.status = 'won' THEN 1 ELSE 0 END)",
        'wonBets',
      )
      .addSelect(
        "SUM(CASE WHEN bet.status = 'lost' THEN 1 ELSE 0 END)",
        'lostBets',
      )
      .addSelect(
        "SUM(CASE WHEN bet.status = 'cancelled' THEN 1 ELSE 0 END)",
        'cancelledBets',
      )
      .addSelect('SUM(bet.stake_amount)', 'totalStaked')
      .addSelect(
        "SUM(CASE WHEN bet.status = 'won' THEN bet.potential_payout ELSE 0 END)",
        'totalWon',
      )
      .where('bet.userId = :userId', { userId })
      .getRawOne();

    const totalBets = parseInt(stats.totalBets) || 0;
    const wonBets = parseInt(stats.wonBets) || 0;
    const lostBets = parseInt(stats.lostBets) || 0;
    const settledBets = wonBets + lostBets;
    const winRate = settledBets > 0 ? (wonBets / settledBets) * 100 : 0;

    return {
      totalBets,
      pendingBets: parseInt(stats.pendingBets) || 0,
      wonBets,
      lostBets,
      cancelledBets: parseInt(stats.cancelledBets) || 0,
      totalStaked: parseFloat(stats.totalStaked) || 0,
      totalWon: parseFloat(stats.totalWon) || 0,
      winRate,
    };
  }
}
