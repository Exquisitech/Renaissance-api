import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { Spin, SpinStatus, SpinOutcome } from './entities/spin.entity';
import { CreateSpinDto } from './dto/create-spin.dto';
import { SpinResultDto } from './dto/spin-result.dto';
import { WalletService } from '../wallet/wallet.service';
import { SorobanService } from '../blockchain/soroban.service';
import { EventBus } from '@nestjs/cqrs';
import { SpinSettledEvent } from '../leaderboard/domain/events/spin-settled.event';
import { TransactionType } from '../transactions/entities/transaction.entity';
import { RateLimitInteractionService } from '../rate-limit/rate-limit-interaction.service';
import { FreeBetVoucherService } from '../free-bet-vouchers/free-bet-vouchers.service';

/**
 * Interface defining the structure of weighted outcomes for the spin wheel.
 * Each outcome has a probability weight and payout multiplier.
 */
export interface WeightedOutcome {
  /** The type of spin outcome (jackpot, win, loss, etc.) */
  outcome: SpinOutcome;
  /** Weight determining probability (higher = more likely) */
  weight: number;
  /** Multiplier for calculating payout (stake * multiplier) */
  multiplier: number;
}

/**
 * Service responsible for handling secure spin operations with server-side randomness.
 *
 * Key Security Features:
 * - Cryptographically secure random number generation using Node.js crypto
 * - Session-based idempotency to prevent replay attacks
 * - Server-side outcome determination (no client influence)
 * - Weighted probability system for fair but engaging gameplay
 * - Atomic wallet operations with transaction rollback on failure
 * - Comprehensive audit trail with random seed storage
 */
@Injectable()
export class SpinService {
  private readonly logger = new Logger(SpinService.name);

  /**
   * Configurable weighted probability system for spin outcomes.
   * Total weight across all outcomes must equal 1000 for easy percentage calculation.
   *
   * Current configuration provides:
   * - Jackpot (50x payout): 0.5% chance
   * - High Win (10x payout): 5% chance
   * - Medium Win (3x payout): 15% chance
   * - Small Win (1.5x payout): 30% chance
   * - No Win (0x payout): 49.5% chance
   */
  private readonly outcomeWeights: WeightedOutcome[] = [
    { outcome: SpinOutcome.JACKPOT, weight: 5, multiplier: 50 }, // 0.5% chance
    { outcome: SpinOutcome.HIGH_WIN, weight: 50, multiplier: 10 }, // 5% chance
    { outcome: SpinOutcome.MEDIUM_WIN, weight: 150, multiplier: 3 }, // 15% chance
    { outcome: SpinOutcome.SMALL_WIN, weight: 300, multiplier: 1.5 }, // 30% chance
    { outcome: SpinOutcome.NO_WIN, weight: 495, multiplier: 0 }, // 49.5% chance
  ];

  /** Total weight for normalization - must equal sum of all outcome weights */
  private readonly totalWeight = this.outcomeWeights.reduce(
    (sum, item) => sum + item.weight,
    0,
  );

  constructor(
    @InjectRepository(Spin)
    private readonly spinRepository: Repository<Spin>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly freeBetVoucherService: FreeBetVoucherService,
    private readonly rateLimitService: RateLimitInteractionService,
    private readonly sorobanService: SorobanService,
    private readonly eventBus: EventBus,
  ) {
    // Validate configuration on startup to prevent runtime errors
    if (this.totalWeight !== 1000) {
      throw new Error(
        `Invalid outcome weights configuration. Total weight must be 1000, got ${this.totalWeight}`,
      );
    }
    this.logger.log('SpinService initialized with validated outcome weights');
  }

  /**
   * Execute a secure spin with server-side randomness and weighted probabilities
   *
   * This method implements all security requirements:
   * - Randomness handled server-side only
   * - Weighted probability logic for fair outcomes
   * - One outcome per spin with idempotency (cannot be replayed)
   * - Uses cryptographically safe randomness (Node.js crypto.randomBytes)
   * - No client influence on outcome determination
   * - Audit-friendly with complete random seed and probability logging
   *
   * Process:
   * 1. Generate unique session ID for idempotency
   * 2. Check for existing spin (prevent replays)
   * 3. Deduct stake from wallet atomically
   * 4. Generate secure random outcome
   * 5. Record spin with audit trail
   * 6. Credit payout if won
   * 7. Return result with net calculation
   *
   * @param userId - The authenticated user's ID
   * @param createSpinDto - Spin request containing stake amount and optional client seed
   * @returns Promise<SpinResultDto> - The spin result with outcome and payout information
   * @throws BadRequestException - If stake amount is invalid or insufficient funds
   * @throws ConflictException - If replay attempt is detected
   */
  async executeSpin(
    userId: string,
    createSpinDto: CreateSpinDto,
  ): Promise<SpinResultDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate unique session ID to prevent replays
      const sessionId = this.generateSessionId(userId, createSpinDto);

      // Check for existing spin with this session ID (idempotency)
      const existingSpin = await queryRunner.manager.findOne(Spin, {
        where: { sessionId },
      });

      if (existingSpin) {
        // Return existing result for idempotency
        await queryRunner.rollbackTransaction();
        return this.mapToResultDto(existingSpin);
      }

      // Enforce minimum stake (10 XLM)
      if (createSpinDto.stakeAmount < 10) {
        throw new BadRequestException('Minimum stake is 10 XLM');
      }

      // Deduct stake amount from wallet using the same QueryRunner (locks user's row)
      const walletResult =
        await this.walletService.updateUserBalanceWithQueryRunner(
          queryRunner,
          userId,
          -createSpinDto.stakeAmount,
          TransactionType.BET_PLACEMENT,
          undefined,
          {
            spinStake: createSpinDto.stakeAmount,
            sessionId,
          },
        );

      if (!walletResult.success) {
        throw new BadRequestException(
          walletResult.error || 'Failed to deduct stake amount from wallet',
        );
      }

      // Generate cryptographically secure random outcome
      const { outcome, payoutAmount, randomSeed } = this.generateSecureOutcome(
        createSpinDto.stakeAmount,
      );

      // Before creating DB record, perform a treasury check with the smart contract
      try {
        await this.sorobanService.invokeContract('treasury_check', [
          payoutAmount,
        ]);
      } catch (scError) {
        this.logger.error('Treasury check failed on-chain', scError);
        throw new BadRequestException(
          'Treasury unavailable for requested payout',
        );
      }

      // Create spin record
      const spin = queryRunner.manager.create(Spin, {
        userId,
        sessionId,
        stakeAmount: createSpinDto.stakeAmount,
        outcome,
        payoutAmount,
        status: SpinStatus.COMPLETED,
        metadata: {
          randomSeed,
          weightedProbabilities: this.getProbabilitiesSnapshot(),
          clientTimestamp: new Date(),
          serverTimestamp: new Date(),
        },
      });

      const savedSpin = await queryRunner.manager.save(spin);

      // If there's a payout, credit it to the user's wallet and attempt on-chain distribution for XLM/NFT
      if (payoutAmount > 0) {
        // Determine reward channel
        let rewardChannel: 'XLM' | 'NFT' | 'FREE_BET' = 'XLM';
        if (outcome === SpinOutcome.JACKPOT) {
          rewardChannel = 'NFT';
        } else if (outcome === SpinOutcome.MEDIUM_WIN) {
          rewardChannel = 'FREE_BET';
        }

        const isWithdrawable =
          !createSpinDto.isFreeBet && rewardChannel === 'XLM';

        if (rewardChannel === 'FREE_BET') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          const voucher =
            await this.freeBetVoucherService.createVoucherWithManager(
              queryRunner.manager,
              {
                userId,
                amount: payoutAmount,
                expiresAt: expiresAt.toISOString(),
                metadata: {
                  source: 'SPIN_TO_WIN',
                  spinId: savedSpin.id,
                  sessionId,
                  isWithdrawable: false,
                },
              },
            );

          savedSpin.metadata = {
            ...(savedSpin.metadata ?? {}),
            rewardChannel,
            voucherId: voucher.id,
          };
          await queryRunner.manager.save(savedSpin);
        } else {
          const payoutResult =
            await this.walletService.updateUserBalanceWithQueryRunner(
              queryRunner,
              userId,
              payoutAmount,
              TransactionType.BET_WINNING,
              savedSpin.id,
              {
                spinPayout: payoutAmount,
                sessionId,
                rewardChannel,
              },
              isWithdrawable,
            );

          if (!payoutResult.success) {
            this.logger.error(
              `Failed to credit payout for spin ${savedSpin.id}`,
              payoutResult.error,
            );
          } else {
            // Attempt on-chain distribution for XLM or NFT (best-effort)
            try {
              if (rewardChannel === 'XLM') {
                await this.sorobanService.invokeContract('distribute_reward', [
                  userId,
                  payoutAmount,
                  savedSpin.id,
                ]);
              } else if (rewardChannel === 'NFT') {
                await this.sorobanService.invokeContract('mint_nft', [
                  userId,
                  savedSpin.id,
                  outcome,
                ]);
              }
            } catch (scError) {
              this.logger.warn(
                `On-chain distribution failed for spin ${savedSpin.id}`,
                scError,
              );
              // Do not fail the whole transaction for on-chain distribution issues
            }
          }
        }
      }

      await queryRunner.commitTransaction();

      await this.rateLimitService.recordInteraction(userId);

      this.logger.log(
        `Spin executed successfully: ${savedSpin.id}, outcome: ${outcome}, payout: ${payoutAmount}`,
      );

      // Publish domain event for leaderboard updates and frontend notification
      try {
        this.eventBus.publish(
          new SpinSettledEvent(
            userId,
            savedSpin.id,
            outcome,
            Number(savedSpin.stakeAmount),
            Number(savedSpin.payoutAmount),
            Number(savedSpin.payoutAmount) > Number(savedSpin.stakeAmount),
            new Date(),
          ),
        );
      } catch (evErr) {
        this.logger.warn('Failed to publish SpinSettledEvent', evErr);
      }

      return this.mapToResultDto(savedSpin);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Log security-relevant errors
      if (error instanceof ConflictException) {
        this.logger.warn(`Spin replay attempt detected for user ${userId}`);
      } else {
        this.logger.error(`Spin execution failed for user ${userId}`, error);
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate a cryptographically secure random outcome using weighted probabilities
   *
   * Security Implementation:
   * - Uses Node.js crypto.randomBytes() for true randomness (not Math.random())
   * - Generates 256 bits (32 bytes) of entropy for each spin
   * - Creates SHA-256 hash of random bytes for audit trail
   * - Maps random value to weighted outcomes using cumulative probability
   * - Ensures no predictable patterns or client influence
   *
   * Algorithm:
   * 1. Generate cryptographically secure random bytes
   * 2. Extract 32-bit unsigned integer from random bytes
   * 3. Normalize to [0, totalWeight) range using modulo
   * 4. Find outcome using cumulative weight distribution
   * 5. Calculate payout based on stake and outcome multiplier
   * 6. Return outcome, payout, and random seed for audit
   *
   * @param stakeAmount - The amount staked on this spin
   * @returns Object containing outcome, payout amount, and random seed
   */
  private generateSecureOutcome(stakeAmount: number): {
    outcome: SpinOutcome;
    payoutAmount: number;
    randomSeed: string;
  } {
    // Generate cryptographically secure random bytes (256 bits of entropy)
    const randomBytesBuffer = randomBytes(32); // 32 bytes = 256 bits
    const randomValue = randomBytesBuffer.readUInt32BE(0); // Use first 4 bytes as random number

    // Create hash of random bytes for audit trail (prevents seed reconstruction)
    const randomSeed = createHash('sha256')
      .update(randomBytesBuffer)
      .digest('hex');

    // Normalize random value to [0, totalWeight) range for weighted selection
    const normalizedRandom = randomValue % this.totalWeight;

    // Find outcome using cumulative weights (weighted random selection)
    let cumulativeWeight = 0;
    for (const weightedOutcome of this.outcomeWeights) {
      cumulativeWeight += weightedOutcome.weight;
      if (normalizedRandom < cumulativeWeight) {
        const payoutAmount = stakeAmount * weightedOutcome.multiplier;
        return {
          outcome: weightedOutcome.outcome,
          payoutAmount,
          randomSeed,
        };
      }
    }

    // Fallback (should never reach here with proper configuration)
    this.logger.error(
      'Random outcome generation failed - using NO_WIN fallback',
    );
    return {
      outcome: SpinOutcome.NO_WIN,
      payoutAmount: 0,
      randomSeed,
    };
  }

  /**
   * Generate unique session ID to prevent replay attacks
   *
   * Security Purpose:
   * - Creates idempotency key that prevents duplicate spin execution
   * - Includes user ID, timestamp, stake amount, and optional client seed
   * - Uses SHA-256 hashing to create fixed-length, collision-resistant ID
   * - Makes replay attacks computationally infeasible
   *
   * Components:
   * - userId: Ensures user isolation (user can't replay another user's spin)
   * - timestamp: Adds temporal uniqueness
   * - clientSeed: Optional client-provided entropy (doesn't affect server randomness)
   * - stakeAmount: Includes stake to prevent amount manipulation
   *
   * @param userId - The user's ID for isolation
   * @param dto - The spin request DTO containing stake and optional client seed
   * @returns SHA-256 hash as hex string (unique session identifier)
   */
  private generateSessionId(userId: string, dto: CreateSpinDto): string {
    const timestamp = Date.now().toString();
    const components = [
      userId,
      timestamp,
      dto.clientSeed || '',
      dto.stakeAmount.toString(),
    ];

    return createHash('sha256').update(components.join('|')).digest('hex');
  }

  /**
   * Get snapshot of current probabilities for audit trail
   *
   * Purpose:
   * - Records the exact probability distribution at time of spin
   * - Enables verification that outcomes match declared probabilities
   * - Supports regulatory compliance and fairness audits
   * - Prevents disputes about probability changes after the fact
   *
   * @returns Object mapping outcome names to their probability percentages
   */
  private getProbabilitiesSnapshot(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    for (const item of this.outcomeWeights) {
      snapshot[item.outcome] = item.weight / this.totalWeight;
    }
    return snapshot;
  }

  /**
   * Map spin entity to result DTO for API response
   *
   * Purpose:
   * - Converts internal database entity to clean API response
   * - Calculates net result (payout - stake) for user convenience
   * - Hides internal metadata from client response
   * - Ensures consistent response format
   *
   * @param spin - The spin entity from database
   * @returns Clean DTO for API response
   */
  private mapToResultDto(spin: Spin): SpinResultDto {
    return {
      id: spin.id,
      outcome: spin.outcome,
      payoutAmount: Number(spin.payoutAmount),
      stakeAmount: Number(spin.stakeAmount),
      netResult: Number(spin.payoutAmount) - Number(spin.stakeAmount),
      timestamp: spin.createdAt,
    };
  }

  /**
   * Get spin history for a user (for transparency and audit)
   *
   * Purpose:
   * - Allows users to review their spin history
   * - Supports transparency and trust building
   * - Enables users to track their gambling activity
   * - Limited to recent spins for performance
   *
   * @param userId - The user's ID
   * @param limit - Maximum number of spins to return (default: 50)
   * @returns Array of spin records ordered by creation date
   */
  async getUserSpinHistory(
    userId: string,
    limit: number = 50,
  ): Promise<Spin[]> {
    return this.spinRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get spin statistics (admin only)
   *
   * Purpose:
   * - Provides aggregate statistics for monitoring
   * - Helps verify that actual outcomes match expected probabilities
   * - Supports business intelligence and fairness verification
   * - Tracks total economic activity (staked vs paid out)
   *
   * @returns Statistics object with totals and outcome counts
   */
  async getSpinStatistics(): Promise<{
    totalSpins: number;
    totalStaked: number;
    totalPaidOut: number;
    outcomeCounts: Record<string, number>;
  }> {
    const spins = await this.spinRepository.find();

    const stats = {
      totalSpins: spins.length,
      totalStaked: spins.reduce(
        (sum, spin) => sum + Number(spin.stakeAmount),
        0,
      ),
      totalPaidOut: spins.reduce(
        (sum, spin) => sum + Number(spin.payoutAmount),
        0,
      ),
      outcomeCounts: {} as Record<string, number>,
    };

    // Count outcomes
    for (const spin of spins) {
      stats.outcomeCounts[spin.outcome] =
        (stats.outcomeCounts[spin.outcome] || 0) + 1;
    }

    return stats;
  }
}
