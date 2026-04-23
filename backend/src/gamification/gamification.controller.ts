import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('achievements')
  @Roles(UserRole.ADMIN)
  async createAchievement(@Body() createDto: CreateAchievementDto) {
    return this.gamificationService.createAchievement(createDto);
  }

  @Get('achievements')
  async getAchievements() {
    return this.gamificationService.getAchievements();
  }

  @Get('users/:userId/achievements')
  async getUserAchievements(@Param('userId') userId: string) {
    return this.gamificationService.getUserAchievements(userId);
  }

  @Get('users/:userId/progress')
  async getUserProgress(@Param('userId') userId: string) {
    return this.gamificationService.getUserProgress(userId);
  }

  @Get('users/:userId/stats')
  async getUserStats(@Param('userId') userId: string) {
    return this.gamificationService.getUserAchievementStats(userId);
  }

  @Get('users/:userId/recent')
  async getRecentAchievements(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getRecentAchievements(
      userId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('events/:eventType')
  async getAchievementsByEvent(@Param('eventType') eventType: string) {
    return this.gamificationService.getAchievementsByEvent(
      eventType as any,
    );
  }
}
