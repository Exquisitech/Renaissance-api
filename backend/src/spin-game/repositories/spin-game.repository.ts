import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, MoreThan } from 'typeorm';
import { SpinGame, RewardType, SpinStatus } from '../entities/spin-game.entity';
import { UserSpinStats } from '../entities/user-spin-stats.entity';
import { FreeBetReward } from '../entities/free-bet-reward.entity';
import { NFTReward, NFTTier } from '../entities/nft-reward.entity';

@Injectable()
export class SpinGameRepository {
  constructor(
    @InjectRepository(SpinGame)
    private readonly spinGameRepo: Repository<SpinGame>,
    @InjectRepository(UserSpinStats)
    private readonly userStatsRepo: Repository<UserSpinStats>,
    @InjectRepository(FreeBetReward)
    private readonly freeBetRepo: Repository<FreeBetReward>,
    @InjectRepository(NFTReward)
    private readonly nftRewardRepo: Repository<NFTReward>,
    private readonly dataSource: DataSource,
  ) {}

  async createSpinGame(spinData: Partial<SpinGame>): Promise<SpinGame> {
    const spin = this.spinGameRepo.create(spinData);
    return await this.spinGameRepo.save(spin);
  }

  async findSpinById(spinId: string): Promise<SpinGame | null> {
    return await this.spinGameRepo.findOne({
      where: { id: spinId },
      relations: ['user'],
    });
  }

  async getUserSpinHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ spins: SpinGame[]; total: number }> {
    const skip = (page - 1) * limit;

    const [spins, total] = await Promise.all([
      this.spinGameRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.spinGameRepo.count({ where: { userId } }),
    ]);

    return { spins, total };
  }

  async getUserStats(userId: string): Promise<UserSpinStats | null> {
    return await this.userStatsRepo.findOne({
      where: { userId },
    });
  }

  async createUserStats(userId: string): Promise<UserSpinStats> {
    const stats = this.userStatsRepo.create({
      userId,
      totalSpins: 0,
      totalStaked: 0,
      totalWon: 0,
      lastResetDate: new Date(),
    });

    return await this.userStatsRepo.save(stats);
  }

  async updateUserStats(
    userId: string,
    updates: Partial<UserSpinStats>,
  ): Promise<UserSpinStats> {
    const stats = await this.getUserStats(userId);
    if (!stats) {
      return await this.createUserStats(userId);
    }

    Object.assign(stats, updates);
    return await this.userStatsRepo.save(stats);
  }

  async resetDailyStatsIfNeeded(stats: UserSpinStats): Promise<UserSpinStats> {
    const today = new Date();
    const lastReset = new Date(stats.lastResetDate);

    // Check if we need to reset daily stats
    if (
      lastReset.getDate() !== today.getDate() ||
      lastReset.getMonth() !== today.getMonth() ||
      lastReset.getFullYear() !== today.getFullYear()
    ) {
      stats.spinsToday = 0;
      stats.lastResetDate = today;
      return await this.userStatsRepo.save(stats);
    }

    return stats;
  }

  async createFreeBet(
    freeBetData: Partial<FreeBetReward>,
  ): Promise<FreeBetReward> {
    const freeBet = this.freeBetRepo.create(freeBetData);
    return await this.freeBetRepo.save(freeBet);
  }

  async getUserFreeBets(userId: string): Promise<FreeBetReward[]> {
    return await this.freeBetRepo.find({
      where: {
        userId,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createNFTReward(nftData: Partial<NFTReward>): Promise<NFTReward> {
    const nft = this.nftRewardRepo.create(nftData);
    return await this.nftRewardRepo.save(nft);
  }

  async getUserNFTRewards(userId: string): Promise<NFTReward[]> {
    return await this.nftRewardRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTodaysSpins(userId: string): Promise<SpinGame[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.spinGameRepo.find({
      where: {
        userId,
        createdAt: Between(today, tomorrow),
      },
    });
  }

  async getRecentWins(userId: string, limit: number = 5): Promise<SpinGame[]> {
    return await this.spinGameRepo.find({
      where: {
        userId,
        rewardType: RewardType.XLM_REWARD,
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async flagSuspiciousSpin(spinId: string): Promise<void> {
    await this.spinGameRepo.update(spinId, {
      isSuspicious: true,
    });
  }

  async getLargeWins(threshold: number): Promise<SpinGame[]> {
    return await this.spinGameRepo
      .createQueryBuilder('spin')
      .where('spin.win_amount > :threshold', { threshold })
      .andWhere('spin.reward_type = :rewardType', {
        rewardType: RewardType.XLM_REWARD,
      })
      .andWhere('spin.is_suspicious = :suspicious', { suspicious: false })
      .orderBy('spin.win_amount', 'DESC')
      .getMany();
  }

  async getSpinStatsForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSpins: number;
    totalStaked: number;
    totalWon: number;
    houseProfit: number;
  }> {
    const result = await this.spinGameRepo
      .createQueryBuilder('spin')
      .select('COUNT(*)', 'totalSpins')
      .addSelect('SUM(spin.stake_amount)', 'totalStaked')
      .addSelect('SUM(COALESCE(spin.win_amount, 0))', 'totalWon')
      .where('spin.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('spin.status = :status', { status: SpinStatus.COMPLETED })
      .getRawOne();

    const totalStaked = parseFloat(result.totalStaked) || 0;
    const totalWon = parseFloat(result.totalWon) || 0;
    const houseProfit = totalStaked - totalWon;

    return {
      totalSpins: parseInt(result.totalSpins) || 0,
      totalStaked,
      totalWon,
      houseProfit,
    };
  }
}
