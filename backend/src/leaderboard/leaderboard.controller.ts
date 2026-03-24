import { Controller, Get, Param, Query } from '@nestjs/common';
import { LeaderboardQueryService } from './leaderboard-query.service';
import { LeaderboardType } from './leaderboard-type.enum';
import {
  LeaderboardAggregationService,
  UserLeaderboardStats,
} from './leaderboard-aggregation.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly queryService: LeaderboardQueryService,
    private readonly aggregationService: LeaderboardAggregationService,
  ) {}

  @Get()
  getLeaderboard(
    @Query('type') type: LeaderboardType,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.queryService.getLeaderboard(type, Number(page), Number(limit));
  }

  /**
   * Get user's comprehensive leaderboard stats
   */
  @Get('user/:userId')
  async getUserStats(
    @Param('userId') userId: string,
  ): Promise<UserLeaderboardStats> {
    return this.aggregationService.getUserLeaderboardStats(userId);
  }

  /**
   * Get top leaderboard entries with derived metrics
   */
  @Get('top')
  async getTopLeaderboard(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<UserLeaderboardStats[]> {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const orderByType = (orderBy as any) || 'netEarnings';

    return this.aggregationService.getTopLeaderboard(
      limitNum,
      offsetNum,
      orderByType,
    );
  }

  /**
   * Get leaderboard summary statistics
   */
  @Get('summary')
  async getLeaderboardSummary(): Promise<any> {
    return this.aggregationService.getLeaderboardSummary();
  }

  /**
   * Get user ranking for specific metric
   */
  @Get('rank/:userId/:metric')
  async getUserRank(
    @Param('userId') userId: string,
    @Param('metric') metric: string,
  ): Promise<{ rank: number; totalUsers: number; percentile: number }> {
    const validMetrics = [
      'netEarnings',
      'roi',
      'bestPredictor',
      'winningStreak',
      'totalBets',
    ];
    if (!validMetrics.includes(metric)) {
      throw new Error(`Invalid metric: ${metric}`);
    }

    const topUsers = await this.aggregationService.getTopLeaderboard(
      1000,
      0,
      metric as any,
    );
    const userIndex = topUsers.findIndex((user) => user.userId === userId);
    const rank = userIndex >= 0 ? userIndex + 1 : -1;
    const totalUsers = topUsers.length;
    const percentile =
      rank > 0 ? ((totalUsers - rank + 1) / totalUsers) * 100 : 0;

    return { rank, totalUsers, percentile: Math.round(percentile * 100) / 100 };
  }
}
