import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardQueryService } from './leaderboard-query.service';
import { LeaderboardType } from './leaderboard-type.enum';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly service: LeaderboardQueryService) {}

  @Get()
  getLeaderboard(
    @Query('type') type: LeaderboardType,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.service.getLeaderboard(
      type,
      Number(page),
      Number(limit),
    );
  }
}
