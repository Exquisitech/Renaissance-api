import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Season, SeasonStatus } from '../entities/season.entity';
import { SeasonalLeaderboard } from '../entities/seasonal-leaderboard.entity';
import { SeasonService } from './season.service';
import { SeasonalLeaderboardService } from './seasonal-leaderboard.service';

@Injectable()
export class SeasonResetService {
  private readonly logger = new Logger(SeasonResetService.name);

  constructor(
    @InjectRepository(Season)
    private readonly seasonRepo: Repository<Season>,
    @InjectRepository(SeasonalLeaderboard)
    private readonly seasonalLeaderboardRepo: Repository<SeasonalLeaderboard>,
    private readonly seasonService: SeasonService,
    private readonly seasonalLeaderboardService: SeasonalLeaderboardService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndResetSeasons(): Promise<void> {
    this.logger.log('Checking for seasons that need to be reset...');

    const now = new Date();
    const expiredSeasons = await this.seasonRepo.find({
      where: {
        status: SeasonStatus.ACTIVE,
        endDate: LessThan(now),
      },
    });

    for (const season of expiredSeasons) {
      await this.resetSeason(season);
    }
  }

  async resetSeason(season: Season): Promise<void> {
    this.logger.log(`Resetting season: ${season.name} (${season.id})`);

    try {
      // Calculate final rankings
      await this.seasonalLeaderboardService.calculateRankings(season.id);

      // Mark season as completed
      await this.seasonService.completeSeason(season.id);

      this.logger.log(`Season ${season.name} has been completed and archived`);
    } catch (error) {
      this.logger.error(`Failed to reset season ${season.id}:`, error);
      throw error;
    }
  }

  async archiveOldSeasons(daysOld: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const oldSeasons = await this.seasonRepo.find({
      where: {
        status: SeasonStatus.COMPLETED,
        endDate: LessThan(cutoffDate),
      },
    });

    for (const season of oldSeasons) {
      await this.seasonService.archiveSeason(season.id);
      this.logger.log(`Archived old season: ${season.name}`);
    }
  }

  async getSeasonHistory(userId: string): Promise<any[]> {
    const history = await this.seasonalLeaderboardRepo
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.user', 'user')
      .leftJoin(Season, 'season', 'season.id = sl.seasonId')
      .select([
        'sl.*',
        'season.name as seasonName',
        'season.seasonNumber as seasonNumber',
        'season.startDate as startDate',
        'season.endDate as endDate',
        'season.status as seasonStatus',
      ])
      .where('sl.userId = :userId', { userId })
      .orderBy('season.seasonNumber', 'DESC')
      .getRawMany();

    return history;
  }
}
