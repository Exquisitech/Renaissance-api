import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AdminAuditLog,
  AdminActionType,
} from './entities/admin-audit-log.entity';
import { Bet, BetStatus } from '../bets/entities/bet.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import {
  CancelBetDto,
  CorrectBalanceDto,
  CorrectMatchDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private dataSource: DataSource,
  ) {}

  /**
   * Cancel a bet and refund the stake amount to the user
   */
  async cancelBet(
    betId: string,
    adminId: string,
    dto: CancelBetDto,
  ): Promise<Bet> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fetch the bet with lock
      const bet = await queryRunner.manager.findOne(Bet, {
        where: { id: betId },
      });

      if (!bet) {
        throw new NotFoundException(`Bet with ID ${betId} not found`);
      }

      if (bet.status !== BetStatus.PENDING) {
        throw new BadRequestException(
          `Cannot cancel bet with status ${bet.status}. Only pending bets can be cancelled.`,
        );
      }

      // Store previous values for audit
      const previousValues = {
        status: bet.status,
        settledAt: bet.settledAt,
      };

      // Get user and check balance
      const user = await queryRunner.manager.findOne(User, {
        where: { id: bet.userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${bet.userId} not found`);
      }

      // Refund the stake amount
      const newBalance = Number(user.walletBalance) + Number(bet.stakeAmount);
      user.walletBalance = newBalance as any;
      await queryRunner.manager.save(User, user);

      // Update bet status
      bet.status = BetStatus.CANCELLED;
      bet.settledAt = new Date();
      await queryRunner.manager.save(Bet, bet);

      // Create refund transaction
      const transaction = this.transactionRepository.create({
        userId: bet.userId,
        type: TransactionType.BET_CANCELLATION,
        amount: bet.stakeAmount,
        status: TransactionStatus.COMPLETED,
        referenceId: betId,
        relatedEntityId: betId,
        metadata: {
          reason: dto.reason,
          cancelledByAdmin: adminId,
        },
      });
      await queryRunner.manager.save(Transaction, transaction);

      // Create audit log
      const auditLog = this.auditLogRepository.create({
        adminId,
        actionType: AdminActionType.BET_CANCELLED,
        affectedUserId: bet.userId,
        affectedEntityId: betId,
        affectedEntityType: 'bet',
        reason: dto.reason,
        previousValues,
        newValues: {
          status: BetStatus.CANCELLED,
          settledAt: bet.settledAt,
        },
        metadata: {
          stakeAmount: bet.stakeAmount,
          userPreviousBalance: user.walletBalance,
          userNewBalance: newBalance,
        },
      });
      await queryRunner.manager.save(AdminAuditLog, auditLog);

      await queryRunner.commitTransaction();
      return bet;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Correct a user's wallet balance
   */
  async correctBalance(
    userId: string,
    adminId: string,
    dto: CorrectBalanceDto,
  ): Promise<User> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const previousBalance = Number(user.walletBalance);
      const newBalance = dto.newBalance;

      if (previousBalance === newBalance) {
        throw new BadRequestException(
          'New balance must be different from current balance',
        );
      }

      // Update user balance
      user.walletBalance = newBalance as any;
      await queryRunner.manager.save(User, user);

      // Create adjustment transaction
      const adjustmentAmount = newBalance - previousBalance;
      const transactionType =
        adjustmentAmount > 0
          ? TransactionType.WALLET_DEPOSIT
          : TransactionType.WALLET_WITHDRAWAL;

      const transaction = this.transactionRepository.create({
        userId,
        type: transactionType,
        amount: Math.abs(adjustmentAmount),
        status: TransactionStatus.COMPLETED,
        metadata: {
          reason: dto.reason,
          adjustedByAdmin: adminId,
          previousBalance,
          newBalance,
        },
      });
      await queryRunner.manager.save(Transaction, transaction);

      // Create audit log
      const auditLog = this.auditLogRepository.create({
        adminId,
        actionType: AdminActionType.BALANCE_CORRECTED,
        affectedUserId: userId,
        affectedEntityId: userId,
        affectedEntityType: 'user',
        reason: dto.reason,
        previousValues: {
          walletBalance: previousBalance,
        },
        newValues: {
          walletBalance: newBalance,
        },
        metadata: {
          adjustmentAmount,
        },
      });
      await queryRunner.manager.save(AdminAuditLog, auditLog);

      await queryRunner.commitTransaction();
      return user;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Correct match details (scores)
   */
  async correctMatch(
    matchId: string,
    adminId: string,
    dto: CorrectMatchDto,
  ): Promise<Match> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await queryRunner.manager.findOne(Match, {
        where: { id: matchId },
      });

      if (!match) {
        throw new NotFoundException(`Match with ID ${matchId} not found`);
      }

      // Store previous values for audit
      const previousValues = {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      };

      // Update match details
      const newValues: Record<string, any> = {};

      if (dto.homeScore !== undefined) {
        match.homeScore = dto.homeScore;
        newValues.homeScore = dto.homeScore;
      }

      if (dto.awayScore !== undefined) {
        match.awayScore = dto.awayScore;
        newValues.awayScore = dto.awayScore;
      }

      await queryRunner.manager.save(Match, match);

      // Create audit log
      const auditLog = this.auditLogRepository.create({
        adminId,
        actionType: AdminActionType.MATCH_CORRECTED,
        affectedEntityId: matchId,
        affectedEntityType: 'match',
        reason: dto.reason,
        previousValues,
        newValues,
        metadata: {
          matchTeams: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      });
      await queryRunner.manager.save(AdminAuditLog, auditLog);

      await queryRunner.commitTransaction();
      return match;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    actionType?: AdminActionType,
  ): Promise<{ data: AdminAuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('log');

    if (actionType) {
      query.where('log.actionType = :actionType', { actionType });
    }

    const total = await query.getCount();

    const data = await query
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: AdminAuditLog[]; total: number }> {
    const query = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.affectedUserId = :userId', { userId });

    const total = await query.getCount();

    const data = await query
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }
}
