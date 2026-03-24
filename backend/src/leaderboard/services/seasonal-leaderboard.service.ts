import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SeasonalLeaderboard,
  LeaderboardTier,
} from '../entities/seasonal-leaderboard.entity';
import { Season } from '../entities/season.entity';
import { SeasonService } from './season.service';

@Injectable()
export class SeasonalLeaderboardService {
  private readonly logger = new Logger(SeasonalLeaderboardService.name);

  constructor(
    @InjectRepository(SeasonalLeaderboard)
    private readonly seasonalLeaderboardRepo: Repository<SeasonalLeaderboard>,
    private readonly seasonService: SeasonService,
  ) {}

  async getUserSeasonStats(
    userId: string,
    seasonId: string,
  ): Promise<SeasonalLeaderboard | null> {
    return this.seasonalLeaderboardRepo.findOne({
      where: { userId, seasonId },
      relations: ['user'],
    });
  }

  async getOrCreateUserSeasonStats(
    userId: string,
    seasonId: string,
  ): Promise<SeasonalLeaderboard> {
    let stats = await this.getUserSeasonStats(userId, seasonId);

    if (!stats) {
      stats = this.seasonalLeaderboardRepo.create({
        userId,
        seasonId,
        tier: LeaderboardTier.BRONZE,
        totalPoints: 0,
      });
      await this.seasonalLeaderboardRepo.save(stats);
    }

    return stats;
  }

  async updateUserStats(
    userId: string,
    seasonId: string,
    updates: Partial<SeasonalLeaderboard>,
  ): Promise<SeasonalLeaderboard> {
    const stats = await this.getOrCreateUserSeasonStats(userId, seasonId);

    Object.assign(stats, updates);

    // Recalculate accuracy
    if (stats.totalBets > 0) {
      stats.bettingAccuracy = Number(
        ((stats.betsWon / stats.totalBets) * 100).toFixed(2),
      );
    }

    // Calculate tier based on points
    const season = await this.seasonService.getSeasonById(seasonId);
    stats.tier = this.calculateTier(stats.totalPoints, season);

    return this.seasonalLeaderboardRepo.save(stats);
  }

  async recordBetResult(
    userId: string,
    seasonId: string,
    isWin: boolean,
    amount: number,
    winnings: number = 0,
  ): Promise<SeasonalLeaderboard> {
    const stats = await this.getOrCreateUserSeasonStats(userId, seasonId);

    stats.totalBets++;
    stats.totalStaked = Number(stats.totalStaked) + amount;

    if (isWin) {
      stats.betsWon++;
      stats.totalWinnings = Number(stats.totalWinnings) + winnings;
      stats.winningStreak++;
      stats.totalPoints = Number(stats.totalPoints) + (winnings - amount);

      if (stats.winningStreak > stats.highestWinningStreak) {
        stats.highestWinningStreak = stats.winningStreak;
      }
    } else {
      stats.betsLost++;
      stats.winningStreak = 0;
      stats.totalPoints = Number(stats.totalPoints) - amount;
    }

    return this.updateUserStats(userId, seasonId, stats);
  }

  async getSeasonLeaderboard(
    seasonId: string,
    limit: number = 100,
    tier?: LeaderboardTier,
  ): Promise<SeasonalLeaderboard[]> {
    const query = this.seasonalLeaderboardRepo
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.user', 'user')
      .where('sl.seasonId = :seasonId', { seasonId })
      .orderBy('sl.totalPoints', 'DESC')
      .take(limit);

    if (tier) {
      query.andWhere('sl.tier = :tier', { tier });
    }

    return query.getMany();
  }

  async calculateRankings(seasonId: string): Promise<void> {
    const leaderboard = await this.getSeasonLeaderboard(seasonId, 10000);

    for (let i = 0; i < leaderboard.length; i++) {
      leaderboard[i].rank = i + 1;
      await this.seasonalLeaderboardRepo.save(leaderboard[i]);
    }

    this.logger.log(
      `Updated rankings for ${leaderboard.length} users in season ${seasonId}`,
    );
  }

  private calculateTier(points: number, season: Season): LeaderboardTier {
    if (points >= season.goldThreshold) {
      return LeaderboardTier.GOLD;
    } else if (points >= season.silverThreshold) {
      return LeaderboardTier.SILVER;
    }
    return LeaderboardTier.BRONZE;
  }

  async getTierDistribution(
    seasonId: string,
  ): Promise<Record<LeaderboardTier, number>> {
    const distribution = await this.seasonalLeaderboardRepo
      .createQueryBuilder('sl')
      .select('sl.tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .where('sl.seasonId = :seasonId', { seasonId })
      .groupBy('sl.tier')
      .getRawMany();

    return {
      [LeaderboardTier.BRONZE]: 0,
      [LeaderboardTier.SILVER]: 0,
      [LeaderboardTier.GOLD]: 0,
      ...distribution.reduce((acc, { tier, count }) => {
        acc[tier] = parseInt(count);
        return acc;
      }, {}),
    };
  }
}
