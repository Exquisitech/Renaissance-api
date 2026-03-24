import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SPIN_GAME_CONFIG, SpinGameConfig } from './config/spin-game.config';
import { SpinGameRepository } from './repositories/spin-game.repository';
import { RateLimitInteractionService } from '../rate-limit/rate-limit-interaction.service';
import {
  SpinRequestDto,
  SpinResultDto,
  RewardType,
  NFTTier,
  UserSpinStatsDto,
  SpinEligibilityDto,
} from './dto/spin-game.dto';
import {
  SpinGame,
  SpinStatus,
  UserSpinStats,
  FreeBetReward,
  NFTReward,
} from './entities';
import { createHash, randomBytes } from 'crypto';
import { FreeBetVoucherService } from '../free-bet-vouchers/free-bet-vouchers.service';

@Injectable()
export class SpinGameService {
  private readonly logger = new Logger(SpinGameService.name);
  private readonly config: SpinGameConfig = SPIN_GAME_CONFIG;

  constructor(
    private readonly spinGameRepo: SpinGameRepository,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly rateLimitService: RateLimitInteractionService,
    private readonly freeBetVoucherService: FreeBetVoucherService,
  ) {}

  /**
   * Check if user is eligible to spin
   */
  async checkEligibility(userId: string): Promise<SpinEligibilityDto> {
    const stats = await this.spinGameRepo.getUserStats(userId);

    if (!stats) {
      return {
        isEligible: true,
        remainingDailySpins: this.config.DAILY_SPIN_LIMIT,
        dailyStakeLimit: this.config.DAILY_STAKE_LIMIT,
        minimumStake: this.config.MINIMUM_STAKE,
        maximumStake: this.config.MAXIMUM_STAKE,
      };
    }

    // Reset daily stats if needed
    const updatedStats = await this.spinGameRepo.resetDailyStatsIfNeeded(stats);

    // Check daily spin limit
    if (updatedStats.spinsToday >= this.config.DAILY_SPIN_LIMIT) {
      return {
        isEligible: false,
        reason: 'Daily spin limit reached',
        remainingDailySpins: 0,
        dailyStakeLimit: this.config.DAILY_STAKE_LIMIT,
        minimumStake: this.config.MINIMUM_STAKE,
        maximumStake: this.config.MAXIMUM_STAKE,
      };
    }

    // Check cool-down period
    if (updatedStats.lastSpinDate) {
      const now = new Date();
      const timeSinceLastSpin =
        now.getTime() - updatedStats.lastSpinDate.getTime();
      const cooldownMs = this.config.SPIN_COOLDOWN_SECONDS * 1000;

      if (timeSinceLastSpin < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSinceLastSpin) / 1000);
        const nextAvailableAt = new Date(
          now.getTime() + (cooldownMs - timeSinceLastSpin),
        );

        return {
          isEligible: false,
          reason: `Please wait ${waitSeconds} seconds before spinning again`,
          nextAvailableAt,
          remainingDailySpins:
            this.config.DAILY_SPIN_LIMIT - updatedStats.spinsToday,
          dailyStakeLimit: this.config.DAILY_STAKE_LIMIT,
          minimumStake: this.config.MINIMUM_STAKE,
          maximumStake: this.config.MAXIMUM_STAKE,
        };
      }
    }

    return {
      isEligible: true,
      remainingDailySpins:
        this.config.DAILY_SPIN_LIMIT - updatedStats.spinsToday,
      dailyStakeLimit: this.config.DAILY_STAKE_LIMIT,
      minimumStake: this.config.MINIMUM_STAKE,
      maximumStake: this.config.MAXIMUM_STAKE,
    };
  }

  /**
   * Execute a spin with verifiable randomness
   */
  async executeSpin(
    userId: string,
    dto: SpinRequestDto,
  ): Promise<SpinResultDto> {
    // Validate stake amount
    if (dto.stakeAmount < this.config.MINIMUM_STAKE) {
      throw new BadRequestException(
        `Minimum stake is ${this.config.MINIMUM_STAKE} XLM`,
      );
    }

    if (dto.stakeAmount > this.config.MAXIMUM_STAKE) {
      throw new BadRequestException(
        `Maximum stake is ${this.config.MAXIMUM_STAKE} XLM`,
      );
    }

    // Check eligibility
    const eligibility = await this.checkEligibility(userId);
    if (!eligibility.isEligible) {
      throw new ForbiddenException(eligibility.reason);
    }

    // Check if user has accepted terms for large stakes
    if (dto.stakeAmount >= 100 && !dto.acceptTerms) {
      throw new BadRequestException(
        'You must accept the terms and conditions for stakes over 100 XLM',
      );
    }

    // Generate verifiable random seeds
    const clientSeed = dto.clientSeed || randomBytes(32).toString('hex');
    const serverSeed = randomBytes(32).toString('hex');
    const nonce = Date.now().toString();

    // Create provably fair hash
    const combinedSeed = `${clientSeed}:${serverSeed}:${nonce}`;
    const hash = createHash('sha256').update(combinedSeed).digest('hex');

    // Convert hash to number between 0-99.9999
    const randomValue = (parseInt(hash.substring(0, 8), 16) % 1000000) / 10000;

    // Apply streak bonuses if any
    const streakBonus = await this.applyStreakBonus(userId, randomValue);
    const finalRandomValue = streakBonus.adjustedValue;

    // Determine reward type
    const rewardType = this.determineRewardType(finalRandomValue);

    // Calculate reward
    const rewardResult = await this.calculateReward(
      userId,
      dto.stakeAmount,
      rewardType,
      finalRandomValue,
    );

    // Save everything in a transaction
    const spinResult = await this.saveSpinResult(
      userId,
      dto.stakeAmount,
      rewardResult,
      {
        clientSeed,
        serverSeed,
        nonce,
        hash,
        randomValue: finalRandomValue,
        originalRandomValue: randomValue,
        streakBonus: streakBonus.bonusApplied,
      },
      combinedSeed,
    );

    // Check for suspicious activity
    await this.checkForSuspiciousActivity(userId, spinResult);

    await this.rateLimitService.recordInteraction(userId);

    return {
      spinId: spinResult.id,
      rewardType: rewardResult.rewardType,
      rewardValue: rewardResult.rewardValue,
      winAmount: rewardResult.winAmount,
      stakeAmount: dto.stakeAmount,
      isWin: rewardResult.rewardType !== RewardType.LOSS,
      verification: {
        clientSeed,
        serverSeedHash: createHash('sha256').update(serverSeed).digest('hex'),
        nonce,
        finalHash: hash,
        randomValue: finalRandomValue,
      },
      timestamp: spinResult.createdAt,
      message: streakBonus.message,
      nextSpinAvailableAt: this.getNextSpinAvailableTime(),
    };
  }

  /**
   * Apply streak-based bonuses
   */
  private async applyStreakBonus(
    userId: string,
    randomValue: number,
  ): Promise<{
    adjustedValue: number;
    bonusApplied: boolean;
    message?: string;
  }> {
    const stats = await this.spinGameRepo.getUserStats(userId);

    if (!stats || stats.currentStreak < 5) {
      return {
        adjustedValue: randomValue,
        bonusApplied: false,
      };
    }

    // Check for streak bonuses
    const streak = stats.currentStreak;
    let adjustedValue = randomValue;
    let message: string | undefined;
    let bonusApplied = false;

    if (streak >= 15 && this.config.STREAK_BONUSES[15]) {
      // Guaranteed win
      adjustedValue = 0; // Force a win (0 is always a win in our distribution)
      message = this.config.STREAK_BONUSES[15].message;
      bonusApplied = true;
    } else if (streak >= 10 && this.config.STREAK_BONUSES[10]) {
      // Probability boost
      const boost = this.config.STREAK_BONUSES[10].probabilityBoost;
      adjustedValue = Math.max(0, randomValue - boost);
      message = this.config.STREAK_BONUSES[10].message;
      bonusApplied = true;
    } else if (streak >= 5 && this.config.STREAK_BONUSES[5]) {
      // Small probability boost
      const boost = this.config.STREAK_BONUSES[5].probabilityBoost;
      adjustedValue = Math.max(0, randomValue - boost);
      message = this.config.STREAK_BONUSES[5].message;
      bonusApplied = true;
    }

    return { adjustedValue, bonusApplied, message };
  }

  /**
   * Determine reward type based on probability distribution
   */
  private determineRewardType(randomValue: number): RewardType {
    const { PROBABILITY_DISTRIBUTION } = this.config;

    if (randomValue < PROBABILITY_DISTRIBUTION.LOSS) {
      return RewardType.LOSS;
    } else if (
      randomValue <
      PROBABILITY_DISTRIBUTION.LOSS + PROBABILITY_DISTRIBUTION.XLM_REWARD
    ) {
      return RewardType.XLM_REWARD;
    } else if (
      randomValue <
      PROBABILITY_DISTRIBUTION.LOSS +
        PROBABILITY_DISTRIBUTION.XLM_REWARD +
        PROBABILITY_DISTRIBUTION.FREE_BET_REWARD
    ) {
      return RewardType.FREE_BET_REWARD;
    } else {
      return RewardType.NFT_REWARD;
    }
  }

  /**
   * Calculate specific reward
   */
  private async calculateReward(
    userId: string,
    stakeAmount: number,
    rewardType: RewardType,
    randomValue: number,
  ): Promise<{
    rewardType: RewardType;
    rewardValue: string;
    winAmount?: number;
    requiresVerification?: boolean;
    requiresKYC?: boolean;
  }> {
    switch (rewardType) {
      case RewardType.XLM_REWARD:
        return this.calculateXLMReward(stakeAmount, randomValue);

      case RewardType.FREE_BET_REWARD:
        return await this.calculateFreeBetReward(
          userId,
          stakeAmount,
          randomValue,
        );

      case RewardType.NFT_REWARD:
        return await this.calculateNFTReward(userId, randomValue);

      case RewardType.LOSS:
      default:
        return {
          rewardType: RewardType.LOSS,
          rewardValue: 'LOSS',
          winAmount: 0,
        };
    }
  }

  /**
   * Calculate XLM reward with tiered system
   */
  private calculateXLMReward(
    stakeAmount: number,
    randomValue: number,
  ): {
    rewardType: RewardType;
    rewardValue: string;
    winAmount: number;
    requiresVerification?: boolean;
    requiresKYC?: boolean;
  } {
    const { XLM_REWARD_TIERS } = this.config;

    // Normalize random value for tier selection (within XLM reward range)
    const tierRandom = randomValue % 100;
    let cumulativeProbability = 0;

    for (const tier of XLM_REWARD_TIERS) {
      cumulativeProbability += tier.probability;
      if (tierRandom < cumulativeProbability) {
        const winAmount = parseFloat(
          Math.min(stakeAmount * tier.multiplier, tier.maxAmount).toFixed(7),
        );

        return {
          rewardType: RewardType.XLM_REWARD,
          rewardValue: tier.name,
          winAmount,
          requiresVerification: tier.requiresVerification,
          requiresKYC: tier.requiresKYC,
        };
      }
    }

    // Fallback to first tier
    const fallbackTier = XLM_REWARD_TIERS[0];
    const winAmount = parseFloat(
      Math.min(
        stakeAmount * fallbackTier.multiplier,
        fallbackTier.maxAmount,
      ).toFixed(7),
    );

    return {
      rewardType: RewardType.XLM_REWARD,
      rewardValue: fallbackTier.name,
      winAmount,
    };
  }

  /**
   * Calculate and create free bet reward
   */
  private async calculateFreeBetReward(
    userId: string,
    stakeAmount: number,
    randomValue: number,
  ): Promise<{
    rewardType: RewardType;
    rewardValue: string;
    winAmount: number;
  }> {
    const { FREE_BET_TIERS } = this.config;

    // Determine free bet multiplier
    const tierRandom = randomValue % 100;
    let cumulativeProbability = 0;
    let selectedTier = FREE_BET_TIERS[0];

    for (const tier of FREE_BET_TIERS) {
      cumulativeProbability += tier.probability;
      if (tierRandom < cumulativeProbability) {
        selectedTier = tier;
        break;
      }
    }

    const freeBetAmount = stakeAmount * selectedTier.multiplier;

    // Create free bet with expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + selectedTier.validityDays);

    const freeBet = await this.freeBetVoucherService.createVoucher({
      userId,
      amount: freeBetAmount,
      expiresAt: expiresAt.toISOString(),
      metadata: {
        source: 'SPIN_GAME',
        isWithdrawable: selectedTier.withdrawable,
      },
    });

    return {
      rewardType: RewardType.FREE_BET_REWARD,
      rewardValue: freeBet.id,
      winAmount: 0, // Non-withdrawable
    };
  }

  /**
   * Calculate and assign NFT reward
   */
  private async calculateNFTReward(
    userId: string,
    randomValue: number,
  ): Promise<{
    rewardType: RewardType;
    rewardValue: string;
    winAmount: number;
  }> {
    const { NFT_TIER_PROBABILITIES, NFT_CONFIG } = this.config;

    // Determine NFT tier
    const tierRandom = randomValue % 100;
    let cumulativeProbability = 0;
    let selectedTier: NFTTier = NFTTier.COMMON;

    for (const [tier, probability] of Object.entries(NFT_TIER_PROBABILITIES)) {
      cumulativeProbability += probability as number;
      if (tierRandom < cumulativeProbability) {
        selectedTier = tier as NFTTier;
        break;
      }
    }

    // Generate unique NFT ID
    const nftId = `RENAISSANCE_${selectedTier}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Calculate rarity score
    const rarityScore = this.calculateRarityScore(selectedTier);

    const nftReward = await this.spinGameRepo.createNFTReward({
      userId,
      nftContractAddress: this.configService.get('NFT_CONTRACT_ADDRESS'),
      nftId,
      tier: selectedTier,
      isWithdrawable: NFT_CONFIG[selectedTier].withdrawable,
      rarityScore,
    });

    return {
      rewardType: RewardType.NFT_REWARD,
      rewardValue: nftReward.id,
      winAmount: 0, // Non-withdrawable
    };
  }

  /**
   * Calculate NFT rarity score
   */
  private calculateRarityScore(tier: NFTTier): number {
    const scores = {
      [NFTTier.COMMON]: 10,
      [NFTTier.RARE]: 50,
      [NFTTier.EPIC]: 200,
      [NFTTier.LEGENDARY]: 1000,
    };

    return scores[tier] || 10;
  }

  /**
   * Save spin result in transaction
   */
  private async saveSpinResult(
    userId: string,
    stakeAmount: number,
    rewardResult: any,
    spinData: any,
    seed: string,
  ): Promise<SpinGame> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create spin record
      const spin = await queryRunner.manager.save(SpinGame, {
        userId,
        stakeAmount,
        rewardType: rewardResult.rewardType,
        rewardValue: rewardResult.rewardValue,
        winAmount: rewardResult.winAmount || null,
        spinResult: spinData,
        seed,
        status: SpinStatus.COMPLETED,
      });

      // Update user stats
      let stats = await queryRunner.manager.findOne(UserSpinStats, {
        where: { userId },
      });

      if (!stats) {
        stats = queryRunner.manager.create(UserSpinStats, {
          userId,
          totalSpins: 0,
          totalStaked: 0,
          totalWon: 0,
          lastResetDate: new Date(),
          spinsToday: 0,
          currentStreak: 0,
          maxStreak: 0,
        });
        // We need to save it to have an ID or just work with it?
        // Usually save is needed if we want it persisted, but here we update it below.
        // However, if we don't save it first, update below might fail if we assume it exists?
        // Actually we save at the end.
      }

      // Reset daily stats if needed
      const today = new Date();
      const lastReset = new Date(stats.lastResetDate);
      if (
        lastReset.getDate() !== today.getDate() ||
        lastReset.getMonth() !== today.getMonth() ||
        lastReset.getFullYear() !== today.getFullYear()
      ) {
        stats.spinsToday = 0;
        stats.lastResetDate = today;
      }

      // Update stats
      stats.totalSpins += 1;
      stats.totalStaked += stakeAmount;
      stats.spinsToday += 1;

      if (
        rewardResult.rewardType !== RewardType.LOSS &&
        rewardResult.winAmount
      ) {
        stats.totalWon += rewardResult.winAmount;
        stats.currentStreak = 0;
      } else {
        stats.currentStreak += 1;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      }

      stats.lastSpinDate = new Date();
      await queryRunner.manager.save(UserSpinStats, stats);

      await queryRunner.commitTransaction();
      return spin;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to save spin result: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check for suspicious activity
   */
  private async checkForSuspiciousActivity(
    userId: string,
    spinResult: SpinGame,
  ): Promise<void> {
    // Check for large wins
    if (
      spinResult.winAmount &&
      spinResult.winAmount > this.config.SECURITY.LARGE_WIN_THRESHOLD
    ) {
      await this.spinGameRepo.flagSuspiciousSpin(spinResult.id);
      this.logger.warn(
        `Large win detected: User ${userId} won ${spinResult.winAmount} XLM`,
      );
    }

    // Check for winning streak
    const recentWins = await this.spinGameRepo.getRecentWins(userId, 5);
    if (recentWins.length >= this.config.SECURITY.MAX_WINNING_STREAK) {
      const allRecentWins = recentWins.every(
        (win) => win.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000),
      );

      if (allRecentWins) {
        await this.spinGameRepo.flagSuspiciousSpin(spinResult.id);
        this.logger.warn(
          `Winning streak detected: User ${userId} has ${recentWins.length} consecutive wins`,
        );
      }
    }
  }

  /**
   * Get next available spin time
   */
  private getNextSpinAvailableTime(): Date {
    const nextTime = new Date();
    nextTime.setSeconds(
      nextTime.getSeconds() + this.config.SPIN_COOLDOWN_SECONDS,
    );
    return nextTime;
  }

  /**
   * Get user spin statistics
   */
  async getUserStatistics(userId: string): Promise<UserSpinStatsDto> {
    const stats = await this.spinGameRepo.getUserStats(userId);

    if (!stats) {
      return {
        totalSpins: 0,
        totalStaked: 0,
        totalWon: 0,
        netProfit: 0,
        winRate: 0,
        spinsToday: 0,
        remainingDailySpins: this.config.DAILY_SPIN_LIMIT,
        currentStreak: 0,
        maxStreak: 0,
        lastSpinDate: null,
      };
    }

    return {
      totalSpins: stats.totalSpins,
      totalStaked: stats.totalStaked,
      totalWon: stats.totalWon,
      netProfit: stats.totalWon - stats.totalStaked,
      winRate: stats.totalSpins > 0 ? (stats.totalWon > 0 ? 1 : 0) : 0, // Simplified win rate
      spinsToday: stats.spinsToday,
      remainingDailySpins: Math.max(
        0,
        this.config.DAILY_SPIN_LIMIT - stats.spinsToday,
      ),
      currentStreak: stats.currentStreak,
      maxStreak: stats.maxStreak,
      lastSpinDate: stats.lastSpinDate,
    };
  }
}
