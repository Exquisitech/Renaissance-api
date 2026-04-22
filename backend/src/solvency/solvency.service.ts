import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SolvencyMetrics } from './solvency-metrics.entity';
import { Bet } from '../bets/entities/bet.entity';
import { SolvencyMetricsDto } from './solvency-metrics.dto';
import { SolvencyProof, ProofStatus } from './entities/solvency-proof.entity';
import { UserBalanceSnapshot } from './entities/user-balance-snapshot.entity';
import { MerkleTree } from './merkle-tree';
import { SorobanService } from '../blockchain/soroban.service';
import { createHash } from 'crypto';

@Injectable()
export class SolvencyService {
  private readonly logger = new Logger(SolvencyService.name);

  constructor(
    @InjectRepository(SolvencyMetrics)
    private readonly metricsRepo: Repository<SolvencyMetrics>,
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
    @InjectRepository(SolvencyProof)
    private readonly proofRepo: Repository<SolvencyProof>,
    @InjectRepository(UserBalanceSnapshot)
    private readonly snapshotRepo: Repository<UserBalanceSnapshot>,
    private readonly sorobanService: SorobanService,
    private readonly dataSource: DataSource,
    // Inject treasury and spin pool services as needed
  ) {}

  async computeAndStoreMetrics(
    treasuryBalance: number,
    spinPoolLiabilities: number,
  ): Promise<SolvencyMetrics> {
    // Compute locked bets and max potential payout
    const [totalLockedBets, maxPotentialPayout] = await this.betRepo
      .createQueryBuilder('bet')
      .select('SUM(bet.stakeAmount)', 'totalLockedBets')
      .addSelect('SUM(bet.potentialPayout)', 'maxPotentialPayout')
      .where('bet.status = :status', { status: 'LOCKED' })
      .getRawOne()
      .then((res) => [
        Number(res.totalLockedBets) || 0,
        Number(res.maxPotentialPayout) || 0,
      ]);

    const coverageRatio =
      maxPotentialPayout > 0 ? treasuryBalance / maxPotentialPayout : 1;
    const spinPoolSolvency =
      spinPoolLiabilities > 0 ? treasuryBalance / spinPoolLiabilities : 1;

    const metrics = this.metricsRepo.create({
      totalLockedBets,
      maxPotentialPayout,
      treasuryBalance,
      coverageRatio,
      spinPoolLiabilities,
      spinPoolSolvency,
    });
    await this.metricsRepo.save(metrics);
    this.logger.log(
      `Solvency metrics stored: Coverage ratio = ${coverageRatio}`,
    );
    return metrics;
  }

  async getLatestMetrics(): Promise<SolvencyMetricsDto> {
    const latest = await this.metricsRepo.findOne({
      order: { createdAt: 'DESC' },
    });
    if (!latest) throw new Error('No solvency metrics found');
    return latest;
  }

  async getMetricsHistory(days = 30): Promise<SolvencyMetricsDto[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { MoreThan } = await import('typeorm');
    return this.metricsRepo.find({
      where: { createdAt: MoreThan(since) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Generate proof of reserves with Merkle tree
   */
  async generateProofOfReserves(
    publishToChain: boolean = true,
  ): Promise<SolvencyProof> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get all user balances
      const userBalances = await this.getAllUserBalances(queryRunner);
      
      // Calculate total liabilities
      const totalLiabilities = userBalances.reduce(
        (sum, balance) => sum + balance,
        0,
      );

      // Get treasury reserves (you might need to adjust this based on your treasury setup)
      const totalReserves = await this.getTreasuryReserves();

      // Calculate solvency ratio
      const solvencyRatio =
        totalLiabilities > 0 ? totalReserves / totalLiabilities : 1;

      // Create Merkle tree from user balances
      const leaves = userBalances.map((balance, index) =>
        this.hashUserBalance(index.toString(), balance),
      );
      const merkleTree = new MerkleTree(leaves);
      const merkleRoot = merkleTree.getRoot();

      if (!merkleRoot) {
        throw new Error('Failed to generate Merkle root');
      }

      // Create proof record
      const proofNumber = `PROOF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const proof = this.proofRepo.create({
        proofNumber,
        proofTimestamp: new Date(),
        merkleRoot,
        totalLiabilities,
        totalReserves,
        solvencyRatio,
        status: ProofStatus.GENERATED,
        metadata: {
          userCount: userBalances.length,
          treeStats: merkleTree.getStats(),
        },
      });

      await queryRunner.manager.save(proof);

      // Store user balance snapshots with Merkle proofs
      await this.storeBalanceSnapshots(
        queryRunner,
        userBalances,
        merkleTree,
        proof.id,
      );

      // Publish to blockchain if requested
      if (publishToChain) {
        try {
          const txHash = await this.sorobanService.invokeContract(
            'publish_solvency_root',
            [
              { type: 'bytes32', value: merkleRoot },
              { type: 'u128', value: BigInt(totalLiabilities) },
              { type: 'u128', value: BigInt(totalReserves) },
            ],
          );

          proof.status = ProofStatus.PUBLISHED;
          proof.transactionHash = txHash;
          proof.publishedAt = new Date();
          await queryRunner.manager.save(proof);
        } catch (error) {
          proof.status = ProofStatus.FAILED;
          proof.failureReason = error.message;
          await queryRunner.manager.save(proof);
          throw error;
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Generated solvency proof ${proofNumber} with root ${merkleRoot}`,
      );

      return proof;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate proof of reserves: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get all user balances for proof generation
   */
  private async getAllUserBalances(queryRunner: any): Promise<number[]> {
    // This would query actual user wallet balances
    // For now, we'll use a simplified approach
    const result = await queryRunner.manager
      .createQueryBuilder('wallet', 'w')
      .select('SUM(w.balance)', 'total')
      .groupBy('w.userId')
      .getRawMany();

    return result.map((r) => Number(r.total) || 0);
  }

  /**
   * Get treasury reserves
   */
  private async getTreasuryReserves(): Promise<number> {
    // Implement based on your treasury setup
    // This could query the treasury contract or database
    return 0; // Placeholder
  }

  /**
   * Hash user balance for Merkle tree leaf
   */
  private hashUserBalance(userId: string, balance: number): string {
    return createHash('sha256')
      .update(`${userId}:${balance}`)
      .digest('hex');
  }

  /**
   * Store balance snapshots with Merkle proofs
   */
  private async storeBalanceSnapshots(
    queryRunner: any,
    balances: number[],
    merkleTree: MerkleTree,
    proofId: string,
  ): Promise<void> {
    const snapshots: UserBalanceSnapshot[] = [];

    balances.forEach((balance, index) => {
      const snapshot = this.snapshotRepo.create({
        userId: `user_${index}`, // Replace with actual user ID
        balance,
        balanceHash: this.hashUserBalance(index.toString(), balance),
        proofId,
        snapshotTimestamp: new Date(),
        leafIndex: index,
        merkleProof: merkleTree.getProof(index),
      });
      snapshots.push(snapshot);
    });

    await queryRunner.manager.save(snapshots);
  }

  /**
   * Verify solvency proof for a user
   */
  async verifyUserProof(
    userId: string,
    proofId: string,
  ): Promise<{
    verified: boolean;
    balance: number;
    merkleRoot: string;
    proof: string[];
  }> {
    const proof = await this.proofRepo.findOne({ where: { id: proofId } });
    if (!proof) {
      throw new BadRequestException('Proof not found');
    }

    const snapshot = await this.snapshotRepo.findOne({
      where: { userId, proofId },
    });

    if (!snapshot) {
      throw new BadRequestException('User snapshot not found for this proof');
    }

    const verified = MerkleTree.verifyProof(
      snapshot.balanceHash,
      snapshot.merkleProof || [],
      proof.merkleRoot,
    );

    return {
      verified,
      balance: snapshot.balance,
      merkleRoot: proof.merkleRoot,
      proof: snapshot.merkleProof || [],
    };
  }

  /**
   * Get historical proofs
   */
  async getHistoricalProofs(limit: number = 10): Promise<SolvencyProof[]> {
    return this.proofRepo.find({
      take: limit,
      order: { proofTimestamp: 'DESC' },
    });
  }

  /**
   * Archive old proofs
   */
  async archiveOldProofs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.proofRepo
      .createQueryBuilder()
      .update()
      .set({ metadata: () => 'CONCAT(metadata, \'\"archived\":true}\')' })
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
