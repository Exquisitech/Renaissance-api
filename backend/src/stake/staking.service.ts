import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Stake } from './entities/stake.entity';
import { StakeDelegation } from './entities/stake-delegation.entity';
import { StakingTier } from './entities/staking-tier.entity';
import { WalletService } from '../wallet/services/wallet.service';

/** Default tiers seeded on first use */
const DEFAULT_TIERS: Pick<StakingTier, 'lockDays' | 'apr' | 'earlyUnstakePenalty'>[] = [
  { lockDays: 30,  apr: 0.12, earlyUnstakePenalty: 0.05 },
  { lockDays: 90,  apr: 0.15, earlyUnstakePenalty: 0.08 },
  { lockDays: 180, apr: 0.20, earlyUnstakePenalty: 0.10 },
  { lockDays: 365, apr: 0.25, earlyUnstakePenalty: 0.15 },
];

const DELEGATION_CUT = 0.01; // 1% of delegatee rewards go to delegator

@Injectable()
export class StakingService {
  constructor(
    @InjectRepository(Stake)
    private stakeRepo: Repository<Stake>,
    @InjectRepository(StakeDelegation)
    private delegationRepo: Repository<StakeDelegation>,
    @InjectRepository(StakingTier)
    private tierRepo: Repository<StakingTier>,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  // ─── #357 Tier helpers ────────────────────────────────────────────────────

  async getTiers(): Promise<StakingTier[]> {
    const tiers = await this.tierRepo.find({ where: { active: true }, order: { lockDays: 'ASC' } });
    if (tiers.length) return tiers;
    // Seed defaults on first call
    const seeded = this.tierRepo.create(DEFAULT_TIERS.map(t => ({ ...t, active: true })));
    return this.tierRepo.save(seeded);
  }

  private async getTierByLockDays(lockDays: number): Promise<StakingTier | null> {
    return this.tierRepo.findOne({ where: { lockDays, active: true } });
  }

  // ─── Core staking ─────────────────────────────────────────────────────────

  /**
   * Stake with optional tier (lockDays) and auto-compound flag (#357, #358)
   */
  async stake(
    playerId: string,
    amount: number,
    stellarTxHash?: string,
    lockDays = 0,
    autoCompound = false,
  ): Promise<Stake> {
    if (amount <= 0) throw new BadRequestException('Stake amount must be positive');

    let apr = 0.12;
    let lockedUntil: Date | undefined;

    if (lockDays > 0) {
      const tier = await this.getTierByLockDays(lockDays);
      if (!tier) throw new BadRequestException(`No tier found for ${lockDays} lock days`);
      apr = Number(tier.apr);
      lockedUntil = new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.walletService.debit(playerId, amount, 'STAKE');
      const s = queryRunner.manager.create(Stake, {
        playerId, amount, stellarTxHash, lockDays, apr, lockedUntil, autoCompound,
      });
      const saved = await queryRunner.manager.save(s);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Unstake with early-exit penalty if still within lock period (#357)
   */
  async unstake(playerId: string, stakeId: string): Promise<Stake> {
    const s = await this.stakeRepo.findOne({ where: { id: stakeId, playerId, active: true } });
    if (!s) throw new NotFoundException('Active stake not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let principal = s.amount;
      let penaltyApplied = 0;

      // Apply early unstake penalty if still locked
      if (s.lockedUntil && new Date() < s.lockedUntil && s.lockDays > 0) {
        const tier = await this.getTierByLockDays(s.lockDays);
        if (tier) {
          penaltyApplied = parseFloat((principal * Number(tier.earlyUnstakePenalty)).toFixed(6));
          principal = parseFloat((principal - penaltyApplied).toFixed(6));
        }
      }

      const total = parseFloat((principal + s.pendingRewards).toFixed(6));
      await this.walletService.credit(playerId, total, 'UNSTAKE');

      s.active = false;
      s.unstakedAt = new Date();
      s.totalClaimed += s.pendingRewards;
      s.pendingRewards = 0;
      const saved = await queryRunner.manager.save(s);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async claimRewards(playerId: string, stakeId: string): Promise<Stake> {
    const s = await this.stakeRepo.findOne({ where: { id: stakeId, playerId, active: true } });
    if (!s) throw new NotFoundException('Active stake not found');
    if (s.pendingRewards <= 0) throw new BadRequestException('No rewards to claim');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.walletService.credit(playerId, s.pendingRewards, 'STAKE_REWARD');
      s.totalClaimed += s.pendingRewards;
      s.pendingRewards = 0;
      const saved = await queryRunner.manager.save(s);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Compound rewards: add pending rewards to principal (#358)
   */
  async compoundRewards(playerId: string, stakeId: string): Promise<Stake> {
    const s = await this.stakeRepo.findOne({ where: { id: stakeId, playerId, active: true } });
    if (!s) throw new NotFoundException('Active stake not found');
    if (s.pendingRewards <= 0) throw new BadRequestException('No rewards to compound');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const compounded = s.pendingRewards;
      s.amount = parseFloat((s.amount + compounded).toFixed(6));
      s.compoundedAmount = parseFloat(((s.compoundedAmount ?? 0) + compounded).toFixed(6));
      s.pendingRewards = 0;
      const saved = await queryRunner.manager.save(s);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Toggle auto-compound flag on a stake (#358)
   */
  async setAutoCompound(playerId: string, stakeId: string, autoCompound: boolean): Promise<Stake> {
    const s = await this.stakeRepo.findOne({ where: { id: stakeId, playerId, active: true } });
    if (!s) throw new NotFoundException('Active stake not found');
    s.autoCompound = autoCompound;
    return this.stakeRepo.save(s);
  }

  // ─── #356 Delegation ──────────────────────────────────────────────────────

  async delegate(delegatorId: string, delegateeId: string, amount: number): Promise<StakeDelegation> {
    if (amount <= 0) throw new BadRequestException('Delegation amount must be positive');
    if (delegatorId === delegateeId) throw new BadRequestException('Cannot delegate to yourself');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.walletService.debit(delegatorId, amount, 'STAKE');
      const d = queryRunner.manager.create(StakeDelegation, { delegatorId, delegateeId, amount });
      const saved = await queryRunner.manager.save(d);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async undelegate(delegatorId: string, delegationId: string): Promise<StakeDelegation> {
    const d = await this.delegationRepo.findOne({ where: { id: delegationId, delegatorId, active: true } });
    if (!d) throw new NotFoundException('Active delegation not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const total = parseFloat((d.amount + d.earnedRewards).toFixed(6));
      await this.walletService.credit(delegatorId, total, 'UNSTAKE');
      d.active = false;
      const saved = await queryRunner.manager.save(d);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getDelegations(playerId: string): Promise<StakeDelegation[]> {
    return this.delegationRepo.find({
      where: [{ delegatorId: playerId }, { delegateeId: playerId }],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Reward distribution ──────────────────────────────────────────────────

  /** Distribute rewards every hour using per-stake APR; auto-compound if flagged (#357, #358) */
  @Cron(CronExpression.EVERY_HOUR)
  async distributeRewards(): Promise<void> {
    const activeStakes = await this.stakeRepo.find({ where: { active: true } });
    if (!activeStakes.length) return;

    const toSave: Stake[] = [];

    for (const s of activeStakes) {
      const hourlyRate = Number(s.apr) / (365 * 24);
      const reward = parseFloat((s.amount * hourlyRate).toFixed(6));

      if (s.autoCompound) {
        // #358: auto-compound — add directly to principal
        s.amount = parseFloat((s.amount + reward).toFixed(6));
        s.compoundedAmount = parseFloat(((s.compoundedAmount ?? 0) + reward).toFixed(6));
      } else {
        s.pendingRewards = parseFloat((s.pendingRewards + reward).toFixed(6));
      }
      toSave.push(s);
    }

    await this.stakeRepo.save(toSave);

    // #356: credit 1% of each stake's reward to active delegators
    const activeDelegations = await this.delegationRepo.find({ where: { active: true } });
    if (!activeDelegations.length) return;

    // Build a map of delegateeId -> total reward earned this cycle
    const delegateeRewards = new Map<string, number>();
    for (const s of activeStakes) {
      const hourlyRate = Number(s.apr) / (365 * 24);
      const reward = parseFloat((s.amount * hourlyRate).toFixed(6));
      delegateeRewards.set(s.playerId, (delegateeRewards.get(s.playerId) ?? 0) + reward);
    }

    const delegationsToSave: StakeDelegation[] = [];
    for (const d of activeDelegations) {
      const delegateeTotal = delegateeRewards.get(d.delegateeId) ?? 0;
      if (delegateeTotal > 0) {
        const cut = parseFloat((delegateeTotal * DELEGATION_CUT).toFixed(6));
        d.earnedRewards = parseFloat((d.earnedRewards + cut).toFixed(6));
        delegationsToSave.push(d);
      }
    }

    if (delegationsToSave.length) await this.delegationRepo.save(delegationsToSave);
  }

  async getPlayerStakes(playerId: string): Promise<Stake[]> {
    return this.stakeRepo.find({ where: { playerId }, order: { stakedAt: 'DESC' } });
  }
}
