import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Stake } from './entities/stake.entity';
import { WalletService } from '../wallet/services/wallet.service';

// Annual Percentage Rate — adjust as needed
const APR = 0.12;
// How often rewards are calculated (hourly)
const REWARD_INTERVAL_HOURS = 1;

@Injectable()
export class StakingService {
  constructor(
    @InjectRepository(Stake)
    private stakeRepo: Repository<Stake>,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  async stake(playerId: string, amount: number, stellarTxHash?: string): Promise<Stake> {
    if (amount <= 0) throw new BadRequestException('Stake amount must be positive');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.walletService.debit(playerId, amount, 'STAKE');

      const s = queryRunner.manager.create(Stake, { playerId, amount, stellarTxHash });
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

  async unstake(playerId: string, stakeId: string): Promise<Stake> {
    const s = await this.stakeRepo.findOne({ where: { id: stakeId, playerId, active: true } });
    if (!s) throw new NotFoundException('Active stake not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Return principal + any pending rewards
      const total = parseFloat((s.amount + s.pendingRewards).toFixed(6));
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

  // Auto-distribute rewards every hour
  @Cron(CronExpression.EVERY_HOUR)
  async distributeRewards(): Promise<void> {
    const activeStakes = await this.stakeRepo.find({ where: { active: true } });
    if (!activeStakes.length) return;

    const hourlyRate = APR / (365 * 24);

    for (const s of activeStakes) {
      const reward = parseFloat((s.amount * hourlyRate).toFixed(6));
      s.pendingRewards = parseFloat((s.pendingRewards + reward).toFixed(6));
    }

    await this.stakeRepo.save(activeStakes);
  }

  async getPlayerStakes(playerId: string): Promise<Stake[]> {
    return this.stakeRepo.find({ where: { playerId }, order: { stakedAt: 'DESC' } });
  }
}