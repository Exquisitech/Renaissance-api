import {
  Controller,
  Get,
  Query,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HttpCacheInterceptor } from '../../common/cache/interceptors/http-cache.interceptor';
import { CacheKey } from '../../common/cache/decorators/cache-key.decorator';
import { RankingService, PaginatedRanking, UserRanking, H2HComparison } from '../services/ranking.service';
import { RankingQueryDto, TimeFrame, RankingType } from '../dto/ranking-query.dto';

@ApiTags('Rankings')
@Controller('rankings')
@UseInterceptors(HttpCacheInterceptor)
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('highest-earners')
  @CacheKey('highest-earners')
  @ApiOperation({
    summary: 'Get highest earners ranking',
    description: 'Retrieve users ranked by total winnings and net earnings with time-based filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ 
    name: 'timeFrame', 
    required: false, 
    enum: TimeFrame, 
    example: TimeFrame.ALL_TIME 
  })
  @ApiResponse({
    status: 200,
    description: 'Highest earners ranking retrieved successfully',
    schema: {
      example: {
        data: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            username: 'pro_bettor',
            email: 'pro@example.com',
            totalWinnings: 15000.50,
            netEarnings: 12500.75,
            roi: 125.5,
            totalBets: 150,
            betsWon: 95,
            bettingAccuracy: 63.33,
            rank: 1,
            lastBetAt: '2024-03-15T10:30:00Z',
          },
        ],
        total: 1000,
        page: 1,
        limit: 10,
        totalPages: 100,
        timeFrame: 'all-time',
        lastUpdated: '2024-03-15T12:00:00Z',
      },
    },
  })
  async getHighestEarners(@Query() query: RankingQueryDto): Promise<PaginatedRanking<any>> {
    return this.rankingService.getHighestEarners(query);
  }

  @Get('biggest-stakers')
  @CacheKey('biggest-stakers')
  @ApiOperation({
    summary: 'Get biggest stakers ranking',
    description: 'Retrieve users ranked by total staked amount and staking rewards with time-based filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ 
    name: 'timeFrame', 
    required: false, 
    enum: TimeFrame, 
    example: TimeFrame.ALL_TIME 
  })
  @ApiResponse({
    status: 200,
    description: 'Biggest stakers ranking retrieved successfully',
    schema: {
      example: {
        data: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            username: 'whale_staker',
            email: 'whale@example.com',
            totalStaked: 50000.00,
            activeStakes: 25000.00,
            totalStakingRewards: 7500.25,
            stakingROI: 15.0,
            rank: 1,
            lastStakeAt: '2024-03-15T09:15:00Z',
          },
        ],
        total: 500,
        page: 1,
        limit: 10,
        totalPages: 50,
        timeFrame: 'all-time',
        lastUpdated: '2024-03-15T12:00:00Z',
      },
    },
  })
  async getBiggestStakers(@Query() query: RankingQueryDto): Promise<PaginatedRanking<any>> {
    return this.rankingService.getBiggestStakers(query);
  }

  @Get('best-predictors')
  @CacheKey('best-predictors')
  @ApiOperation({
    summary: 'Get best predictors ranking',
    description: 'Retrieve users ranked by betting accuracy and prediction confidence with time-based filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ 
    name: 'timeFrame', 
    required: false, 
    enum: TimeFrame, 
    example: TimeFrame.ALL_TIME 
  })
  @ApiResponse({
    status: 200,
    description: 'Best predictors ranking retrieved successfully',
    schema: {
      example: {
        data: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            username: 'oracle_predictor',
            email: 'oracle@example.com',
            bettingAccuracy: 78.5,
            totalBets: 200,
            betsWon: 157,
            betsLost: 43,
            winningStreak: 12,
            highestWinningStreak: 25,
            confidence: 85.35,
            rank: 1,
            lastBetAt: '2024-03-15T11:45:00Z',
          },
        ],
        total: 750,
        page: 1,
        limit: 10,
        totalPages: 75,
        timeFrame: 'all-time',
        lastUpdated: '2024-03-15T12:00:00Z',
      },
    },
  })
  async getBestPredictors(@Query() query: RankingQueryDto): Promise<PaginatedRanking<any>> {
    return this.rankingService.getBestPredictors(query);
  }

  @Get('user/:userId/:rankingType')
  @CacheKey('user-position')
  @ApiOperation({
    summary: 'Get user position in rankings',
    description: 'Retrieve a specific user\'s position and percentile in any ranking category',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'rankingType',
    description: 'Type of ranking',
    enum: RankingType,
    example: RankingType.EARNERS,
  })
  @ApiResponse({
    status: 200,
    description: 'User position retrieved successfully',
    schema: {
      example: {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'pro_bettor',
        rank: 15,
        value: 8500.75,
        percentile: 98.5,
        totalUsers: 1000,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found in rankings',
  })
  async getUserPosition(
    @Param('userId') userId: string,
    @Param('rankingType') rankingType: RankingType,
  ): Promise<UserRanking | null> {
    return this.rankingService.getUserPosition(userId, rankingType);
  }

  @Get('summary')
  @CacheKey('rankings-summary')
  @ApiOperation({
    summary: 'Get rankings summary',
    description: 'Retrieve summary statistics for all ranking categories',
  })
  @ApiQuery({ 
    name: 'timeFrame', 
    required: false, 
    enum: TimeFrame, 
    example: TimeFrame.ALL_TIME 
  })
  @ApiResponse({
    status: 200,
    description: 'Rankings summary retrieved successfully',
    schema: {
      example: {
        highestEarners: {
          topUser: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            username: 'pro_bettor',
            totalWinnings: 15000.50,
          },
          totalUsers: 1000,
          averageEarnings: 1250.75,
          top10PercentThreshold: 5000.00,
        },
        biggestStakers: {
          topUser: {
            userId: '456e7890-f12c-34d5-b678-901234567890',
            username: 'whale_staker',
            totalStaked: 50000.00,
          },
          totalUsers: 500,
          averageStaked: 2500.00,
          top10PercentThreshold: 15000.00,
        },
        bestPredictors: {
          topUser: {
            userId: '789e0123-d34f-56g7-c890-123456789012',
            username: 'oracle_predictor',
            bettingAccuracy: 78.5,
          },
          totalUsers: 750,
          averageAccuracy: 45.2,
          top10PercentThreshold: 65.0,
        },
        timeFrame: 'all-time',
        lastUpdated: '2024-03-15T12:00:00Z',
      },
    },
  })
  async getRankingsSummary(
    @Query('timeFrame') timeFrame: TimeFrame = TimeFrame.ALL_TIME,
  ): Promise<any> {    const [earners, stakers, predictors] = await Promise.all([
      this.rankingService.getHighestEarners({ page: 1, limit: 10, timeFrame }),
      this.rankingService.getBiggestStakers({ page: 1, limit: 10, timeFrame }),
      this.rankingService.getBestPredictors({ page: 1, limit: 10, timeFrame }),
    ]);

    return {
      highestEarners: {
        topUser: earners.data[0] || null,
        totalUsers: earners.total,
        averageEarnings: earners.data.length > 0 
          ? earners.data.reduce((sum, user) => sum + user.totalWinnings, 0) / earners.data.length 
          : 0,
        top10PercentThreshold: earners.data.length > 0 
          ? earners.data[Math.floor(earners.data.length * 0.1)]?.totalWinnings || 0 
          : 0,
      },
      biggestStakers: {
        topUser: stakers.data[0] || null,
        totalUsers: stakers.total,
        averageStaked: stakers.data.length > 0 
          ? stakers.data.reduce((sum, user) => sum + user.totalStaked, 0) / stakers.data.length 
          : 0,
        top10PercentThreshold: stakers.data.length > 0 
          ? stakers.data[Math.floor(stakers.data.length * 0.1)]?.totalStaked || 0 
          : 0,
      },
      bestPredictors: {
        topUser: predictors.data[0] || null,
        totalUsers: predictors.total,
        averageAccuracy: predictors.data.length > 0 
          ? predictors.data.reduce((sum, user) => sum + user.bettingAccuracy, 0) / predictors.data.length 
          : 0,
        top10PercentThreshold: predictors.data.length > 0 
          ? predictors.data[Math.floor(predictors.data.length * 0.1)]?.bettingAccuracy || 0 
          : 0,
      },
      timeFrame,
      lastUpdated: new Date(),
    };
  }

  @Get('h2h/:userAId/:userBId')
  @ApiOperation({ summary: 'Head-to-head comparison between two users' })
  @ApiParam({ name: 'userAId', description: 'First user UUID' })
  @ApiParam({ name: 'userBId', description: 'Second user UUID' })
  @ApiResponse({ status: 200, description: 'H2H comparison result' })
  async getH2H(
    @Param('userAId') userAId: string,
    @Param('userBId') userBId: string,
  ): Promise<H2HComparison> {
    return this.rankingService.getH2HComparison(userAId, userBId);
  }
}
