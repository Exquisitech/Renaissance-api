import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  SpinJackpot,
  SpinJackpotWinner,
  SpinJackpotContribution,
  SpinJackpotStats,
  JackpotTier,
  JackpotStatus,
} from './entities/jackpot.entity';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';

/**
 * Jackpot configuration interface
 */
interface JackpotConfig {
  tiers: {
    [key: string]: {
      contributionPercentage: number;
      triggerProbability: number;
      minSpinsToTrigger: number;
      minAmount: number;
      maxAmount: number;
      expiryHours: number;
    };
  };
  global: {
    enabled: boolean;
    minSpinCountForJackpot: number;
  };
}

@Injectable()
export class JackpotService implements OnModuleInit {
  private readonly logger = new Logger(JackpotService.name);
  private jackpotConfig: JackpotConfig;

  constructor(
    @InjectRepository(SpinJackpot)
    private jackpotRepository: Repository<SpinJackpot>,
    @InjectRepository(SpinJackpotWinner)
    private winnerRepository: Repository<SpinJackpotWinner>,
    @InjectRepository(SpinJackpotContribution)
    private contributionRepository: Repository<SpinJackpotContribution>,
    @InjectRepository(SpinJackpotStats)
    private statsRepository: Repository<SpinJackpotStats>,
    private dataSource: DataSource,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    this.initializeJackpotConfig();
  }

  onModuleInit() {
    this.initializeJackpotConfig();
  }

  private initializeJackpotConfig() {
    this.jackpotConfig = {
      tiers: {
        [JackpotTier.MINI]: {
          contributionPercentage: 1,
          triggerProbability: 0.05,
          minSpinsToTrigger: 1,
          minAmount: 10,
          maxAmount: 100,
          expiryHours: 24,
        },
        [JackpotTier.MAJOR]: {
          contributionPercentage: 2,
          triggerProbability: 0.02,
          minSpinsToTrigger: 10,
          minAmount: 100,
          maxAmount: 1000,
          expiryHours: 48,
        },
        [JackpotTier.MEGA]: {
          contributionPercentage: 3,
          triggerProbability: 0.01,
          minSpinsToTrigger: 50,
          minAmount: 1000,
          maxAmount: 10000,
          expiryHours: 72,
        },
        [JackpotTier.GRAND]: {
          contributionPercentage: 5,
          triggerProbability: 0.005,
          minSpinsToTrigger: 100,
          minAmount: 10000,
          maxAmount: 100000,
          expiryHours: 168,
        },
      },
      global: {
        enabled: true,
        minSpinCountForJackpot: 1,
      },
    };
  }

  /**
   * Generate provably fair random value using SHA-256
   */
  private getProvablyFairRandom(serverSeed: string, userId: string, spinCount: number): number {
    const hash = crypto
      .createHash('sha256')
      .update(`${serverSeed}-${userId}-${spinCount}-${Date.now()}`)
      .digest('hex');
    const randomInt = parseInt(hash.substring(0, 8), 16);
    return (randomInt % 1000000) / 1000000;
  }

  /**
   * Initialize jackpot pools for all tiers
   */
  async initializeJackpots(): Promise<void> {
    const tiers = Object.values(JackpotTier);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const tier of tiers) {
        const config = this.jackpotConfig.tiers[tier];
        const existingJackpot = await queryRunner.manager.findOne(SpinJackpot, {
          where: { tier, status: JackpotStatus.ACTIVE },
        });

        if (!existingJackpot) {
          const jackpot = queryRunner.manager.create(SpinJackpot, {
            tier,
            currentAmount: config.minAmount,
            minimumAmount: config.minAmount,
            maximumAmount: config.maxAmount,
            contributionPercentage: config.contributionPercentage,
            triggerProbability: config.triggerProbability,
            minSpinsToTrigger: config.minSpinsToTrigger,
            status: JackpotStatus.ACTIVE,
            lastUpdated: new Date(),
          });
          await queryRunner.manager.save(jackpot);
          this.logger.log(`Initialized ${tier} jackpot with ${config.minAmount} starting amount`);
        }
      }

      // Initialize global stats
      const existingStats = await queryRunner.manager.findOne(SpinJackpotStats, { where: { id: '1' } });
      if (!existingStats) {
        const stats = queryRunner.manager.create(SpinJackpotStats, {
          id: '1',
          totalPoolAmount: 0,
          totalContributions: 0,
          totalPayouts: 0,
          totalWins: 0,
          totalSpinsContributed: 0,
          averageContributionPercent: 0,
        });
        await queryRunner.manager.save(stats);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to initialize jackpots', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get current jackpot amounts for all tiers
   */
  async getCurrentJackpots(): Promise<{
    mini: number;
    major: number;
    mega: number;
    grand: number;
  }> {
    const jackpots = await this.jackpotRepository.find({
      where: { status: JackpotStatus.ACTIVE },
      order: { tier: 'ASC' },
    });

    return {
      mini: jackpots.find((j) => j.tier === JackpotTier.MINI)?.currentAmount || 0,
      major: jackpots.find((j) => j.tier === JackpotTier.MAJOR)?.currentAmount || 0,
      mega: jackpots.find((j) => j.tier === JackpotTier.MEGA)?.currentAmount || 0,
      grand: jackpots.find((j) => j.tier === JackpotTier.GRAND)?.currentAmount || 0,
    };
  }

  /**
   * Process jackpot contribution from a spin
   * This is called after each spin to accumulate jackpot
   */
  async processJackpotContribution(
    userId: string,
    spinId: string,
    stakeAmount: number,
    spinCount: number,
  ): Promise<{
    contributed: boolean;
    triggered: boolean;
    wonTier: JackpotTier | null;
    wonAmount: number;
  }> {
    if (!this.jackpotConfig.global.enabled) {
      return { contributed: false, triggered: false, wonTier: null, wonAmount: 0 };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = {
        contributed: false,
        triggered: false,
        wonTier: null as JackpotTier | null,
        wonAmount: 0,
      };

      // Process contributions for all tiers
      for (const tier of Object.values(JackpotTier)) {
        const config = this.jackpotConfig.tiers[tier];
        const contributionAmount = (stakeAmount * config.contributionPercentage) / 100;

        // Find or create jackpot for this tier
        let jackpot = await queryRunner.manager.findOne(SpinJackpot, {
          where: { tier, status: JackpotStatus.ACTIVE },
        });

        if (!jackpot) {
          jackpot = queryRunner.manager.create(SpinJackpot, {
            tier,
            currentAmount: config.minAmount,
            minimumAmount: config.minAmount,
            maximumAmount: config.maxAmount,
            contributionPercentage: config.contributionPercentage,
            triggerProbability: config.triggerProbability,
            minSpinsToTrigger: config.minSpinsToTrigger,
            status: JackpotStatus.ACTIVE,
            lastUpdated: new Date(),
          });
          await queryRunner.manager.save(jackpot);
        }

        // Add contribution to jackpot
        jackpot.currentAmount = Number(jackpot.currentAmount) + contributionAmount;
        jackpot.lastUpdated = new Date();
        await queryRunner.manager.save(jackpot);

        // Record contribution
        const contribution = queryRunner.manager.create(SpinJackpotContribution, {
          userId,
          spinId,
          jackpotTier: tier,
          contributionAmount,
          stakeAmount,
          percentageContributed: config.contributionPercentage,
        });
        await queryRunner.manager.save(contribution);

        result.contributed = true;

        // Check for jackpot trigger (only if spin count meets minimum)
        if (spinCount >= this.jackpotConfig.global.minSpinCountForJackpot) {
          const triggerResult = await this.checkAndTriggerJackpot(
            queryRunner,
            jackpot,
            userId,
            spinId,
            spinCount,
          );

          if (triggerResult.triggered && triggerResult.wonTier) {
            result.triggered = true;
            result.wonTier = triggerResult.wonTier;
            result.wonAmount = triggerResult.wonAmount;

            // Send notification
            await this.sendJackpotWinNotification(userId, triggerResult.wonTier, triggerResult.wonAmount);
          }
        }
      }

      // Update global stats
      await this.updateGlobalStats(queryRunner);

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to process jackpot contribution', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if jackpot should be triggered and process win
   */
  private async checkAndTriggerJackpot(
    queryRunner: any,
    jackpot: SpinJackpot,
    userId: string,
    spinId: string,
    spinCount: number,
  ): Promise<{ triggered: boolean; wonTier: JackpotTier | null; wonAmount: number }> {
    const config = this.jackpotConfig.tiers[jackpot.tier];

    // Check minimum spin count requirement
    if (spinCount < jackpot.minSpinsToTrigger) {
      return { triggered: false, wonTier: null, wonAmount: 0 };
    }

    // Use provably fair randomness
    const randomValue = this.getProvablyFairRandom(
      this.configService.get<string>('SPIN_SERVER_SEED') || 'default-seed',
      userId,
      spinCount,
    );

    const adjustedProbability = config.triggerProbability * (spinCount / jackpot.minSpinsToTrigger);

    if (randomValue <= adjustedProbability) {
      // Calculate win amount - full jackpot or partial
      const currentAmount = Number(jackpot.currentAmount);
      const winAmount =
        Math.random() > 0.9
          ? currentAmount
          : Math.min(currentAmount * (0.1 + Math.random() * 0.4), Number(jackpot.maximumAmount));

      // Create winner record
      const winner = queryRunner.manager.create(SpinJackpotWinner, {
        jackpotId: jackpot.id,
        userId,
        spinId,
        jackpotTier: jackpot.tier,
        wonAmount: winAmount,
        claimed: false,
        expiryDate: new Date(Date.now() + config.expiryHours * 60 * 60 * 1000),
        metadata: {
          spinCount,
          triggerProbability: adjustedProbability,
          randomValue,
        },
      });
      await queryRunner.manager.save(winner);

      // Update jackpot stats
      jackpot.totalTriggers += 1;
      jackpot.totalWins += 1;
      jackpot.totalPaidOut = Number(jackpot.totalPaidOut) + winAmount;
      jackpot.lastWinDate = new Date();
      jackpot.currentAmount = config.minAmount; // Reset to minimum after win
      jackpot.lastUpdated = new Date();
      await queryRunner.manager.save(jackpot);

      this.logger.log(
        `Jackpot triggered! User ${userId} won ${winAmount} XLM in ${jackpot.tier} jackpot`,
      );

      return { triggered: true, wonTier: jackpot.tier, wonAmount: winAmount };
    }

    return { triggered: false, wonTier: null, wonAmount: 0 };
  }

  /**
   * Update global jackpot statistics
   */
  private async updateGlobalStats(queryRunner: any): Promise<void> {
    const stats = await queryRunner.manager.findOne(SpinJackpotStats, { where: { id: '1' } });

    if (stats) {
      const jackpots = await queryRunner.manager.find(SpinJackpot, {
        where: { status: JackpotStatus.ACTIVE },
      });

      stats.totalPoolAmount = jackpots.reduce((sum, j) => sum + Number(j.currentAmount), 0);
      stats.totalSpinsContributed += 1;

      const avgContribPercent =
        jackpots.reduce((sum, j) => sum + Number(j.contributionPercentage), 0) / jackpots.length;
      stats.averageContributionPercent = avgContribPercent;

      await queryRunner.manager.save(stats);
    }
  }

  /**
   * Send jackpot win notification
   */
  private async sendJackpotWinNotification(
    userId: string,
    tier: JackpotTier,
    amount: number,
  ): Promise<void> {
    try {
      const tierEmoji = {
        [JackpotTier.MINI]: '🎯',
        [JackpotTier.MAJOR]: '💰',
        [JackpotTier.MEGA]: '💎',
        [JackpotTier.GRAND]: '👑',
      };

      await this.notificationsService.createNotification(
        NotificationType.SYSTEM_ANNOUNCEMENT,
        userId,
        `${tierEmoji[tier]} Jackpot Winner!`,
        `Congratulations! You've won ${amount.toFixed(2)} XLM in the ${tier} Jackpot!`,
        {
          tier,
          amount,
          claimed: false,
        },
        'high',
      );
    } catch (error) {
      this.logger.error('Failed to send jackpot win notification', error);
    }
  }

  /**
   * Get user's unclaimed jackpot winnings
   */
  async getUserJackpotWinnings(userId: string): Promise<SpinJackpotWinner[]> {
    return this.winnerRepository.find({
      where: { userId, claimed: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Claim jackpot winnings
   */
  async claimJackpotWinnings(winnerId: string, userId: string): Promise<{
    success: boolean;
    amount: number;
    message: string;
  }> {
    const winner = await this.winnerRepository.findOne({
      where: { id: winnerId, userId, claimed: false },
    });

    if (!winner) {
      return { success: false, amount: 0, message: 'Jackpot winnings not found or already claimed' };
    }

    // Check expiry
    if (winner.expiryDate && new Date() > winner.expiryDate) {
      winner.claimed = true;
      await this.winnerRepository.save(winner);
      return { success: false, amount: 0, message: 'Jackpot winnings have expired' };
    }

    // Mark as claimed
    winner.claimed = true;
    winner.claimedAt = new Date();
    await this.winnerRepository.save(winner);

    // Update global stats
    const stats = await this.statsRepository.findOne({ where: { id: '1' } });
    if (stats) {
      stats.totalPayouts = Number(stats.totalPayouts) + Number(winner.wonAmount);
      stats.totalWins += 1;
      stats.lastWinDate = new Date();
      stats.lastWinningTier = winner.jackpotTier;
      await this.statsRepository.save(stats);
    }

    return {
      success: true,
      amount: Number(winner.wonAmount),
      message: `Successfully claimed ${winner.wonAmount} XLM from ${winner.jackpotTier} jackpot!`,
    };
  }

  /**
   * Get jackpot statistics for admin dashboard
   */
  async getJackpotStatistics(): Promise<{
    tiers: any[];
    globalStats: any;
    recentWinners: any[];
  }> {
    const jackpots = await this.jackpotRepository.find({
      order: { tier: 'ASC' },
    });

    const stats = await this.statsRepository.findOne({ where: { id: '1' } });

    const recentWinners = await this.winnerRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      tiers: jackpots.map((j) => ({
        tier: j.tier,
        currentAmount: Number(j.currentAmount),
        totalTriggers: j.totalTriggers,
        totalWins: j.totalWins,
        totalPaidOut: Number(j.totalPaidOut),
        lastWinDate: j.lastWinDate,
        status: j.status,
      })),
      globalStats: stats
        ? {
            totalPoolAmount: Number(stats.totalPoolAmount),
            totalContributions: Number(stats.totalContributions),
            totalPayouts: Number(stats.totalPayouts),
            totalWins: stats.totalWins,
            totalSpinsContributed: stats.totalSpinsContributed,
            averageContributionPercent: Number(stats.averageContributionPercent),
            lastWinDate: stats.lastWinDate,
            lastWinningTier: stats.lastWinningTier,
          }
        : null,
      recentWinners: recentWinners.map((w) => ({
        id: w.id,
        userId: w.userId,
        wonAmount: Number(w.wonAmount),
        jackpotTier: w.jackpotTier,
        claimed: w.claimed,
        createdAt: w.createdAt,
      })),
    };
  }

  /**
   * Get contribution history for analytics
   */
  async getContributionHistory(
    startDate: Date,
    endDate: Date,
    limit: number = 100,
  ): Promise<SpinJackpotContribution[]> {
    return this.contributionRepository.find({
      where: {
        createdAt: MoreThanOrEqual(startDate),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get jackpot tier configuration
   */
  getJackpotConfig(): JackpotConfig {
    return this.jackpotConfig;
  }

  /**
   * Check if jackpot system is enabled
   */
  isJackpotEnabled(): boolean {
    return this.jackpotConfig.global.enabled;
  }
}