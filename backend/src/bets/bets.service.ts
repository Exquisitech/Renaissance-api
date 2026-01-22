import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bet, BetStatus } from './entities/bet.entity';
import {
  Match,
  MatchStatus,
  MatchOutcome,
} from '../matches/entities/match.entity';
import { CreateBetDto } from './dto/create-bet.dto';
import { UpdateBetStatusDto } from './dto/update-bet-status.dto';
import { WalletService } from '../wallet/wallet.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';

export interface PaginatedBets {
  data: Bet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

      // Deduct stake amount from user wallet using wallet service
      // This ensures proper transaction history tracking
      const walletResult = await this.walletService.updateUserBalance(
        userId,
        -Number(createBetDto.stakeAmount), // Negative amount for deduction
        TransactionType.BET_PLACEMENT,
        undefined,
        {
          matchId: createBetDto.matchId,
          predictedOutcome: createBetDto.predictedOutcome,
        },
      );

      if (!walletResult.success) {
        throw new BadRequestException(
          walletResult.error || 'Failed to deduct stake amount from wallet',
        );
      }

      // Calculate odds based on predicted outcome
      const odds = this.getOddsForOutcome(match, createBetDto.predictedOutcome);

      // Calculate potential payout
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
      });

      const savedBet = await queryRunner.manager.save(bet);

      // Update the transaction record with bet ID
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: {
          userId,
          type: TransactionType.BET_PLACEMENT,
          status: TransactionStatus.COMPLETED,
        },
        order: { createdAt: 'DESC' } as any,
      });

      if (transaction) {
        transaction.relatedEntityId = savedBet.id;
        await queryRunner.manager.save(transaction);
      }

      await queryRunner.commitTransaction();

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

    const [data, total] = await this.betRepository.findAndCount({
      where: { matchId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Remove sensitive user data
    const sanitizedData = data.map((bet) => {
      if (bet.user) {
        const userWithoutSensitive = { ...bet.user };
        delete (userWithoutSensitive as { password?: string }).password;
        return { ...bet, user: userWithoutSensitive };
      }
      return bet;
    });

    return {
      data: sanitizedData,
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

    return this.betRepository.save(bet);
  }

  /**
   * Settle all bets for a match based on the match outcome
   * Uses transaction for atomic operations including wallet updates
   */
  async settleMatchBets(matchId: string): Promise<{
    settled: number;
    won: number;
    lost: number;
    totalPayout: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the match
      const match = await queryRunner.manager.findOne(Match, {
        where: { id: matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.status !== MatchStatus.FINISHED) {
        throw new BadRequestException(
          'Cannot settle bets: Match is not finished',
        );
      }

      if (!match.outcome) {
        throw new BadRequestException(
          'Cannot settle bets: Match outcome not set',
        );
      }

      // Get all pending bets for this match
      const pendingBets = await queryRunner.manager.find(Bet, {
        where: { matchId, status: BetStatus.PENDING },
        relations: ['user'],
      });

      let won = 0;
      let lost = 0;
      let totalPayout = 0;

      // Settle each bet
      for (const bet of pendingBets) {
        if (bet.predictedOutcome === match.outcome) {
          // Winner - distribute payout
          bet.status = BetStatus.WON;
          won++;
          totalPayout += Number(bet.potentialPayout);

          // Credit winnings to user wallet
          await this.walletService.updateUserBalance(
            bet.userId,
            Number(bet.potentialPayout),
            TransactionType.BET_WINNING,
            bet.id,
            {
              matchId: bet.matchId,
              stakeAmount: Number(bet.stakeAmount),
              payoutAmount: Number(bet.potentialPayout),
            },
          );
        } else {
          // Loser - no payout
          bet.status = BetStatus.LOST;
          lost++;
        }
        bet.settledAt = new Date();
        await queryRunner.manager.save(bet);
      }

      await queryRunner.commitTransaction();

      return {
        settled: pendingBets.length,
        won,
        lost,
        totalPayout,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
      await this.walletService.updateUserBalance(
        bet.userId,
        Number(bet.stakeAmount),
        TransactionType.BET_CANCELLATION,
        bet.id,
        {
          matchId: bet.matchId,
          stakeAmount: Number(bet.stakeAmount),
          cancellationReason: isAdmin ? 'admin_cancelled' : 'user_cancelled',
        },
      );

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
    const bets = await this.betRepository.find({
      where: { userId },
    });

    const stats = {
      totalBets: bets.length,
      pendingBets: 0,
      wonBets: 0,
      lostBets: 0,
      cancelledBets: 0,
      totalStaked: 0,
      totalWon: 0,
      winRate: 0,
    };

    for (const bet of bets) {
      stats.totalStaked += Number(bet.stakeAmount);

      switch (bet.status) {
        case BetStatus.PENDING:
          stats.pendingBets++;
          break;
        case BetStatus.WON:
          stats.wonBets++;
          stats.totalWon += Number(bet.potentialPayout);
          break;
        case BetStatus.LOST:
          stats.lostBets++;
          break;
        case BetStatus.CANCELLED:
          stats.cancelledBets++;
          break;
      }
    }

    const settledBets = stats.wonBets + stats.lostBets;
    stats.winRate = settledBets > 0 ? (stats.wonBets / settledBets) * 100 : 0;

    return stats;
  }
}
