import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SorobanService } from '../blockchain/soroban.service';
import { WalletService } from '../wallet/wallet.service';
import { Bet, BetStatus } from '../bets/entities/bet.entity';
import { User } from '../users/entities/user.entity';
import {
  TreasuryDistribution,
  DistributionStatus,
} from '../entities/treasury-distribution.entity';
import {
  TreasuryDistributionBatch,
  DistributionBatchStatus,
} from '../entities/treasury-distribution-batch.entity';
import {
  TreasuryAuditLog,
  AuditAction,
} from '../entities/treasury-audit-log.entity';
import { WinnerDto } from '../dto/treasury.dto';
import { Address } from '@stellar/stellar-sdk';

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    @InjectRepository(TreasuryDistribution)
    private readonly distributionRepo: Repository<TreasuryDistribution>,
    @InjectRepository(TreasuryDistributionBatch)
    private readonly batchRepo: Repository<TreasuryDistributionBatch>,
    @InjectRepository(TreasuryAuditLog)
    private readonly auditRepo: Repository<TreasuryAuditLog>,
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sorobanService: SorobanService,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Aggregate winners from settled bets
   */
  async aggregateWinners(
    matchId?: string,
    limit: number = 1000,
  ): Promise<WinnerDto[]> {
    const query = this.betRepo
      .createQueryBuilder('bet')
      .innerJoinAndSelect('bet.user', 'user')
      .where('bet.status = :status', { status: BetStatus.WON })
      .andWhere('bet.settledAt IS NOT NULL')
      .orderBy('bet.settledAt', 'DESC')
      .take(limit);

    if (matchId) {
      query.andWhere('bet.matchId = :matchId', { matchId });
    }

    const winningBets = await query.getMany();

    return winningBets.map((bet) => ({
      userId: bet.userId,
      betId: bet.id,
      stakeAmount: Number(bet.stakeAmount),
      odds: Number(bet.odds),
      potentialPayout: Number(bet.potentialPayout),
      prizeAmount: Number(bet.potentialPayout),
    }));
  }

  /**
   * Calculate prize amounts based on bet amounts and odds
   * Can apply custom prize calculation logic if needed
   */
  calculatePrizeAmount(
    stakeAmount: number,
    odds: number,
    metadata?: any,
  ): number {
    // Default: full payout based on odds
    let prizeAmount = stakeAmount * odds;

    // Apply any bonus multipliers or adjustments from metadata
    if (metadata?.bonusMultiplier) {
      prizeAmount *= metadata.bonusMultiplier;
    }

    if (metadata?.fixedBonus) {
      prizeAmount += metadata.fixedBonus;
    }

    return Math.floor(prizeAmount); // Ensure integer amount
  }

  /**
   * Initiate prize distribution to winners
   */
  async distributeToWinners(
    winners: WinnerDto[],
    allowPartialDistribution: boolean = true,
  ): Promise<{
    batchId: string;
    status: DistributionBatchStatus;
    totalDistributed: number;
    failedCount: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create distribution batch
      const batchNumber = `DIST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const batch = this.batchRepo.create({
        batchNumber,
        status: DistributionBatchStatus.INITIATED,
        totalPrizeAmount: winners.reduce((sum, w) => sum + w.prizeAmount, 0),
        totalWinners: winners.length,
      });

      await queryRunner.manager.save(batch);

      // Log batch initiation
      await this.logAudit(
        null,
        batch.id,
        AuditAction.DISTRIBUTION_INITIATED,
        `Initiated distribution batch ${batchNumber} for ${winners.length} winners`,
        batch.totalPrizeAmount,
        null,
        { winners: winners.map((w) => w.userId) },
        queryRunner.manager,
      );

      // Update batch status
      batch.status = DistributionBatchStatus.IN_PROGRESS;
      await queryRunner.manager.save(batch);

      let totalDistributed = 0;
      let failedCount = 0;
      const distributions: TreasuryDistribution[] = [];

      // Process each winner
      for (const winner of winners) {
        try {
          const distribution = await this.processSingleDistribution(
            queryRunner,
            batch,
            winner,
          );
          distributions.push(distribution);
          totalDistributed += Number(distribution.distributedAmount);
        } catch (error) {
          this.logger.error(
            `Failed to distribute prize to user ${winner.userId}: ${error.message}`,
          );
          failedCount++;

          // Log failure
          await this.logAudit(
            null,
            batch.id,
            AuditAction.DISTRIBUTION_FAILED,
            `Failed to distribute prize to user ${winner.userId}`,
            winner.prizeAmount,
            winner.userId,
            { error: error.message, betId: winner.betId },
            queryRunner.manager,
          );
        }
      }

      // Determine final batch status
      const successfulCount = distributions.length;
      const partialCount = distributions.filter(
        (d) => d.status === DistributionStatus.PARTIAL,
      ).length;

      if (failedCount === winners.length) {
        batch.status = DistributionBatchStatus.FAILED;
        batch.failureReason = 'All distributions failed';
      } else if (partialCount > 0 || failedCount > 0) {
        batch.status = DistributionBatchStatus.PARTIAL_COMPLETION;
        batch.partialDistributions = partialCount;
        batch.failedDistributions = failedCount;
      } else {
        batch.status = DistributionBatchStatus.COMPLETED;
      }

      batch.successfulDistributions = successfulCount;
      batch.totalDistributedAmount = totalDistributed;
      batch.completedAt = new Date();
      await queryRunner.manager.save(batch);

      // Log batch completion
      await this.logAudit(
        null,
        batch.id,
        AuditAction.BATCH_COMPLETED,
        `Batch ${batchNumber} completed: ${successfulCount}/${winners.length} successful`,
        totalDistributed,
        null,
        {
          successful: successfulCount,
          failed: failedCount,
          partial: partialCount,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return {
        batchId: batch.id,
        status: batch.status,
        totalDistributed,
        failedCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process distribution batch: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process single distribution to a winner
   */
  private async processSingleDistribution(
    queryRunner: any,
    batch: TreasuryDistributionBatch,
    winner: WinnerDto,
  ): Promise<TreasuryDistribution> {
    const distribution = this.distributionRepo.create({
      batchId: batch.id,
      status: DistributionStatus.PENDING,
      userId: winner.userId,
      betId: winner.betId,
      prizeAmount: winner.prizeAmount,
      distributedAmount: 0,
      pendingAmount: winner.prizeAmount,
      reason: 'Bet settlement winnings',
      metadata: {
        stakeAmount: winner.stakeAmount,
        odds: winner.odds,
        potentialPayout: winner.potentialPayout,
      },
    });

    await queryRunner.manager.save(distribution);

    // Log distribution start
    await this.logAudit(
      distribution.id,
      batch.id,
      AuditAction.DISTRIBUTION_STARTED,
      `Starting distribution to user ${winner.userId}`,
      winner.prizeAmount,
      winner.userId,
      { betId: winner.betId },
      queryRunner.manager,
    );

    try {
      // Check treasury balance (you might want to add a method to check contract balance)
      // For now, we'll proceed with the distribution

      // Invoke treasury contract's distribute_to_winners function
      // Note: You might need to add this function to your treasury contract
      const userAddress = await this.getUserStellarAddress(winner.userId);
      
      const txHash = await this.sorobanService.invokeContract(
        'distribute_to_winners',
        [
          { type: 'address', value: userAddress },
          { type: 'u128', value: BigInt(winner.prizeAmount) },
          { type: 'bytes32', value: winner.betId },
        ],
      );

      distribution.transactionHash = txHash;
      distribution.distributedAmount = winner.prizeAmount;
      distribution.pendingAmount = 0;
      distribution.status = DistributionStatus.COMPLETED;
      distribution.distributedAt = new Date();

      await queryRunner.manager.save(distribution);

      // Log successful distribution
      await this.logAudit(
        distribution.id,
        batch.id,
        AuditAction.DISTRIBUTION_COMPLETED,
        `Successfully distributed prize to user ${winner.userId}`,
        winner.prizeAmount,
        winner.userId,
        { transactionHash: txHash },
        queryRunner.manager,
      );

      return distribution;
    } catch (error) {
      // Handle partial distribution if treasury has insufficient funds
      if (error.message.includes('insufficient') || error.message.includes('balance')) {
        distribution.status = DistributionStatus.PARTIAL;
        distribution.reason = 'Insufficient treasury funds';
        distribution.metadata = {
          ...distribution.metadata,
          error: error.message,
          retryable: true,
        };
        await queryRunner.manager.save(distribution);

        await this.logAudit(
          distribution.id,
          batch.id,
          AuditAction.PARTIAL_DISTRIBUTION,
          `Partial distribution to user ${winner.userId} - insufficient treasury funds`,
          winner.prizeAmount,
          winner.userId,
          { error: error.message },
          queryRunner.manager,
        );
      } else {
        distribution.status = DistributionStatus.FAILED;
        distribution.reason = error.message;
        await queryRunner.manager.save(distribution);
      }

      throw error;
    }
  }

  /**
   * Get user's Stellar address from user ID
   */
  private async getUserStellarAddress(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }

    // Assuming user has a stellarAddress field, adjust as needed
    // If not, you might need to derive it from their public key or store it
    return user.stellarAddress || user.walletAddress || '';
  }

  /**
   * Log audit trail entry
   */
  private async logAudit(
    distributionId: string | null,
    batchId: string | null,
    action: AuditAction,
    description: string,
    amount: number | null,
    userId: string | null,
    metadata: Record<string, any> | null,
    manager: Repository<any>,
    errorMessage?: string,
    transactionHash?: string,
  ): Promise<void> {
    const auditLog = this.auditRepo.create({
      distributionId,
      batchId,
      action,
      description,
      amount,
      userId,
      metadata,
      errorMessage: errorMessage || null,
      transactionHash: transactionHash || null,
    });

    await manager.save(auditLog);
  }

  /**
   * Get distribution batch details
   */
  async getBatchDetails(batchId: string): Promise<TreasuryDistributionBatch> {
    const batch = await this.batchRepo.findOne({
      where: { id: batchId },
      relations: ['distributions'],
    });

    if (!batch) {
      throw new BadRequestException(`Batch ${batchId} not found`);
    }

    return batch;
  }

  /**
   * Get audit logs for a batch or distribution
   */
  async getAuditLogs(
    batchId?: string,
    distributionId?: string,
  ): Promise<TreasuryAuditLog[]> {
    const query = this.auditRepo.createQueryBuilder('audit');

    if (batchId) {
      query.where('audit.batchId = :batchId', { batchId });
    }

    if (distributionId) {
      query.andWhere('audit.distributionId = :distributionId', {
        distributionId,
      });
    }

    return query.orderBy('audit.createdAt', 'DESC').getMany();
  }
}
