import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';

export interface StakeResult {
  success: boolean;
  stakedAmount: number;
  rewardAmount: number;
  endDate: Date;
  transactionId?: string;
  error?: string;
}

export interface StakingConfig {
  minStakeAmount: number;
  maxStakeAmount: number;
  durationDays: number;
  apr: number; // Annual Percentage Rate
}

@Injectable()
export class StakingService {
  private readonly config: StakingConfig = {
    minStakeAmount: 10, // Minimum 10 units
    maxStakeAmount: 10000, // Maximum 10,000 units
    durationDays: 30, // 30-day staking period
    apr: 12, // 12% annual percentage rate
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Stake tokens for rewards
   * Uses transaction to ensure atomicity between wallet deduction and staking record creation
   */
  async stakeTokens(userId: string, amount: number): Promise<StakeResult> {
    // Validate amount
    if (amount < this.config.minStakeAmount) {
      throw new BadRequestException(
        `Minimum stake amount is ${this.config.minStakeAmount}`,
      );
    }

    if (amount > this.config.maxStakeAmount) {
      throw new BadRequestException(
        `Maximum stake amount is ${this.config.maxStakeAmount}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get user with lock
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has sufficient balance
      if (Number(user.walletBalance) < Number(amount)) {
        throw new BadRequestException(
          'Insufficient wallet balance for staking',
        );
      }

      // Calculate reward amount based on APR and duration
      const dailyRate = this.config.apr / 365 / 100;
      const rewardAmount =
        Number(amount) * dailyRate * this.config.durationDays;

      // Create staking transaction record
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        type: TransactionType.STAKING_PENALTY, // Initial penalty (funds locked)
        amount: -amount, // Negative amount as funds are locked
        status: TransactionStatus.PENDING,
        metadata: {
          operation: 'stake_tokens',
          stakedAmount: amount,
          rewardAmount,
          durationDays: this.config.durationDays,
          apr: this.config.apr,
          startDate: new Date().toISOString(),
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Deduct from user wallet (funds are now locked)
      user.walletBalance = Number(user.walletBalance) - Number(amount);
      await queryRunner.manager.save(user);

      // Mark transaction as completed
      savedTransaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(savedTransaction);

      // Calculate end date
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + this.config.durationDays);

      await queryRunner.commitTransaction();

      return {
        success: true,
        stakedAmount: Number(amount),
        rewardAmount: Number(rewardAmount),
        endDate,
        transactionId: savedTransaction.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Claim staking rewards
   * Uses transaction to ensure atomicity between reward distribution and wallet update
   */
  async claimRewards(userId: string, stakeId: string): Promise<StakeResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the staking transaction
      const stakeTransaction = await queryRunner.manager.findOne(Transaction, {
        where: {
          id: stakeId,
          userId,
          type: TransactionType.STAKING_PENALTY,
          status: TransactionStatus.COMPLETED,
        },
      });

      if (!stakeTransaction) {
        throw new NotFoundException(
          'Staking record not found or already claimed',
        );
      }

      // Check if staking period has ended
      const startDate = new Date(stakeTransaction.createdAt);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + this.config.durationDays);

      if (new Date() < endDate) {
        throw new BadRequestException('Staking period has not yet ended');
      }

      // Get reward amount from metadata
      const rewardAmount = Number(stakeTransaction.metadata.rewardAmount);
      const stakedAmount = Number(stakeTransaction.metadata.stakedAmount);

      // Create reward transaction
      const rewardTransaction = queryRunner.manager.create(Transaction, {
        userId,
        type: TransactionType.STAKING_REWARD,
        amount: rewardAmount,
        status: TransactionStatus.PENDING,
        referenceId: stakeId,
        metadata: {
          operation: 'claim_rewards',
          stakedAmount,
          rewardAmount,
          originalStakeId: stakeId,
        },
      });

      const savedRewardTransaction =
        await queryRunner.manager.save(rewardTransaction);

      // Update user wallet with rewards
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.walletBalance =
        Number(user.walletBalance) +
        Number(rewardAmount) +
        Number(stakedAmount);
      await queryRunner.manager.save(user);

      // Mark reward transaction as completed
      savedRewardTransaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(savedRewardTransaction);

      // Mark original stake as claimed/reversed
      stakeTransaction.status = TransactionStatus.REVERSED;
      await queryRunner.manager.save(stakeTransaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        stakedAmount: Number(stakedAmount),
        rewardAmount: Number(rewardAmount),
        endDate: endDate,
        transactionId: savedRewardTransaction.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get user's active stakes
   */
  async getActiveStakes(userId: string): Promise<Transaction[]> {
    const stakes = await this.transactionRepository.find({
      where: {
        userId,
        type: TransactionType.STAKING_PENALTY,
        status: TransactionStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });

    // Filter out expired stakes
    const now = new Date();
    return stakes.filter((stake) => {
      const startDate = new Date(stake.createdAt);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + this.config.durationDays);
      return now < endDate;
    });
  }

  /**
   * Get user's staking history
   */
  async getStakingHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.transactionRepository.findAndCount({
      where: {
        userId,
        type: TransactionType.STAKING_PENALTY,
      },
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
   * Get staking configuration
   */
  getConfig(): StakingConfig {
    return { ...this.config };
  }

  /**
   * Early unstake (with penalty)
   * Uses transaction to ensure atomicity
   */
  async earlyUnstake(
    userId: string,
    stakeId: string,
    penaltyPercent: number = 25,
  ): Promise<StakeResult> {
    if (penaltyPercent < 0 || penaltyPercent > 100) {
      throw new BadRequestException(
        'Penalty percentage must be between 0 and 100',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the staking transaction
      const stakeTransaction = await queryRunner.manager.findOne(Transaction, {
        where: {
          id: stakeId,
          userId,
          type: TransactionType.STAKING_PENALTY,
          status: TransactionStatus.COMPLETED,
        },
      });

      if (!stakeTransaction) {
        throw new NotFoundException('Staking record not found');
      }

      const stakedAmount = Number(stakeTransaction.metadata.stakedAmount);
      const penaltyAmount = stakedAmount * (penaltyPercent / 100);
      const returnAmount = stakedAmount - penaltyAmount;

      // Create penalty transaction
      const penaltyTransaction = queryRunner.manager.create(Transaction, {
        userId,
        type: TransactionType.STAKING_PENALTY,
        amount: -penaltyAmount, // Additional penalty
        status: TransactionStatus.PENDING,
        referenceId: stakeId,
        metadata: {
          operation: 'early_unstake',
          stakedAmount,
          penaltyPercent,
          penaltyAmount,
          returnAmount,
        },
      });

      const savedPenaltyTransaction =
        await queryRunner.manager.save(penaltyTransaction);

      // Update user wallet with remaining amount (minus penalty)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.walletBalance = Number(user.walletBalance) + Number(returnAmount);
      await queryRunner.manager.save(user);

      // Mark penalty transaction as completed
      savedPenaltyTransaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(savedPenaltyTransaction);

      // Mark original stake as reversed
      stakeTransaction.status = TransactionStatus.REVERSED;
      await queryRunner.manager.save(stakeTransaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        stakedAmount: Number(stakedAmount),
        rewardAmount: -Number(penaltyAmount), // Negative indicates loss
        endDate: new Date(), // Immediate
        transactionId: savedPenaltyTransaction.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
