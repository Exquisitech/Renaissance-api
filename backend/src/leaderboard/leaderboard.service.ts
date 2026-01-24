import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Leaderboard } from './entities/leaderboard.entity';
import { User } from '../users/entities/user.entity';
import {
  BetPlacedEvent,
  BetSettledEvent,
  StakeCreditedEvent,
  StakeDebitedEvent,
} from './domain/events';

/**
 * LeaderboardService handles atomic updates to leaderboard statistics
 * All operations are transaction-aware to ensure consistency
 */
@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(Leaderboard)
    private readonly leaderboardRepository: Repository<Leaderboard>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Initialize or retrieve leaderboard for a user
   * Creates entry if not exists
   */
  async ensureLeaderboardExists(userId: string): Promise<Leaderboard> {
    let leaderboard = await this.leaderboardRepository.findOne({
      where: { userId },
    });

    if (!leaderboard) {
      leaderboard = this.leaderboardRepository.create({
        userId,
      });
      await this.leaderboardRepository.save(leaderboard);
      this.logger.log(`Created leaderboard for user ${userId}`);
    }

    return leaderboard;
  }

  /**
   * Handle bet placed event
   * Updates activity tracking
   */
  async handleBetPlaced(event: BetPlacedEvent): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId: event.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!leaderboard) {
        const newLeaderboard = queryRunner.manager.create(Leaderboard, {
          userId: event.userId,
        });
        await queryRunner.manager.save(newLeaderboard);
      } else {
        leaderboard.lastBetAt = event.timestamp;
        await queryRunner.manager.save(leaderboard);
      }

      await queryRunner.commitTransaction();
      this.logger.debug(
        `Updated leaderboard for bet placed event - User: ${event.userId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle bet placed event for user ${event.userId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle bet settled event
   * Updates betting stats, accuracy, and winning streak atomically
   */
  async handleBetSettled(event: BetSettledEvent): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId: event.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!leaderboard) {
        throw new Error(
          `Leaderboard not found for user ${event.userId} during bet settlement`,
        );
      }

      // Update total bets
      leaderboard.totalBets++;

      // Update win/loss stats
      if (event.isWin) {
        leaderboard.betsWon++;
        leaderboard.totalWinnings += event.winningsAmount;
      } else {
        leaderboard.betsLost++;
      }

      // Update accuracy (only on settlement, not on placement)
      leaderboard.recalculateAccuracy();

      // Update winning streak
      leaderboard.updateWinningStreak(event.isWin);

      await queryRunner.manager.save(leaderboard);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Updated leaderboard for bet settlement - User: ${event.userId}, Win: ${event.isWin}, ` +
          `Accuracy: ${leaderboard.bettingAccuracy}%, Streak: ${leaderboard.winningStreak}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle bet settled event for user ${event.userId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle stake credited event
   * Updates staking stats atomically
   */
  async handleStakeCredited(event: StakeCreditedEvent): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId: event.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!leaderboard) {
        throw new Error(
          `Leaderboard not found for user ${event.userId} during stake credit`,
        );
      }

      leaderboard.totalStakingRewards += event.rewardAmount;
      leaderboard.lastStakeAt = event.timestamp;

      await queryRunner.manager.save(leaderboard);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Updated leaderboard for stake credited - User: ${event.userId}, ` +
          `Reward: ${event.rewardAmount}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle stake credited event for user ${event.userId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle stake debited event
   * Updates staking stats atomically
   */
  async handleStakeDebited(event: StakeDebitedEvent): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const leaderboard = await queryRunner.manager.findOne(Leaderboard, {
        where: { userId: event.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!leaderboard) {
        throw new Error(
          `Leaderboard not found for user ${event.userId} during stake debit`,
        );
      }

      // Only deduct from activeStakes if it was an active stake
      if (event.reason === 'unstake') {
        leaderboard.activeStakes -= event.stakedAmount;
      }

      leaderboard.lastStakeAt = event.timestamp;

      await queryRunner.manager.save(leaderboard);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Updated leaderboard for stake debited - User: ${event.userId}, ` +
          `Amount: ${event.stakedAmount}, Reason: ${event.reason}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to handle stake debited event for user ${event.userId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get user's leaderboard stats
   */
  async getLeaderboardStats(userId: string): Promise<Leaderboard | null> {
    return this.leaderboardRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  /**
   * Get top leaderboard entries
   */
  async getTopLeaderboard(
    limit: number = 100,
    offset: number = 0,
    orderBy:
      | 'totalWinnings'
      | 'bettingAccuracy'
      | 'winningStreak' = 'totalWinnings',
  ): Promise<Leaderboard[]> {
    const query = this.leaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('leaderboard.user', 'user')
      .select([
        'leaderboard.id',
        'leaderboard.userId',
        'leaderboard.totalWinnings',
        'leaderboard.bettingAccuracy',
        'leaderboard.winningStreak',
        'leaderboard.totalBets',
        'leaderboard.betsWon',
        'leaderboard.betsLost',
        'user.id',
        'user.username',
        'user.email',
      ]);

    if (orderBy === 'totalWinnings') {
      query.orderBy('leaderboard.totalWinnings', 'DESC');
    } else if (orderBy === 'bettingAccuracy') {
      query
        .where('leaderboard.totalBets > :minBets', { minBets: 10 })
        .orderBy('leaderboard.bettingAccuracy', 'DESC');
    } else if (orderBy === 'winningStreak') {
      query.orderBy('leaderboard.winningStreak', 'DESC');
    }

    return query.skip(offset).take(limit).getMany();
  }
}
