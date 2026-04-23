import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Achievement,
  TriggerEvent,
  RuleType,
} from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { EventBus } from '@nestjs/cqrs';
import { AchievementUnlockedEvent } from './events/achievement-unlocked.event';
import { CreateAchievementDto } from './dto/create-achievement.dto';

@Injectable()
export class GamificationService {
  async seedBadges() {
    // Import badge seed data
    const { badgeSeedData } = await import('./badge-seed-data.js');
    for (const badge of badgeSeedData) {
      const exists = await this.achievementRepository.findOne({
        where: { name: badge.name },
      });
      if (!exists) {
        await this.createAchievement(badge);
      }
    }
  }
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepository: Repository<UserAchievement>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBus,
  ) {}

  async createAchievement(dto: CreateAchievementDto): Promise<Achievement> {
    const achievement = this.achievementRepository.create(dto);
    return this.achievementRepository.save(achievement);
  }

  async getAchievements(): Promise<Achievement[]> {
    return this.achievementRepository.find();
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
    });
  }

  /**
   * Process a gamification event.
   * This handles fetching active achievements for this event, updating progress, and awarding if complete.
   */
  async processEvent(
    userId: string,
    eventType: TriggerEvent,
    eventPayload: Record<string, any>,
  ) {
    // Fetch all active achievements for this event type
    const achievements = await this.achievementRepository.find({
      where: { triggerEvent: eventType, isActive: true },
    });

    if (achievements.length === 0) return;

    for (const achievement of achievements) {
      if (!this.matchesCondition(achievement, eventPayload)) {
        continue;
      }

      await this.evaluateAchievement(userId, achievement, eventPayload);
    }
  }

  /**
   * Evaluates an achievement idempotently using database transactions and locks
   */
  private async evaluateAchievement(
    userId: string,
    achievement: Achievement,
    eventPayload: Record<string, any>,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find or create user achievement tracker with pessimistic write lock
      let userAchievement = await queryRunner.manager.findOne(UserAchievement, {
        where: { userId, achievementId: achievement.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (userAchievement && userAchievement.isCompleted) {
        // Idempotency: Already awarded, ignore
        await queryRunner.rollbackTransaction();
        return;
      }

      if (!userAchievement) {
        userAchievement = queryRunner.manager.create(UserAchievement, {
          userId,
          achievementId: achievement.id,
          currentProgress: 0,
          isCompleted: false,
        });
      }

      // Calculate value to add based on rule type
      let incrementValue = 0;
      switch (achievement.ruleType) {
        case RuleType.COUNT:
          incrementValue = 1;
          break;
        case RuleType.SUM_AMOUNT:
          incrementValue = Number(
            eventPayload['amount'] || eventPayload['stakeAmount'] || 0,
          );
          break;
        case RuleType.SPECIFIC_CONDITION:
          incrementValue = 1; // Assuming specific condition met implies 1 increment (e.g., win a specific bet)
          break;
      }

      // Update progress
      userAchievement.currentProgress =
        Number(userAchievement.currentProgress) + incrementValue;

      // Check if unlocked
      if (userAchievement.currentProgress >= Number(achievement.targetValue)) {
        userAchievement.currentProgress = Number(achievement.targetValue); // Cap it
        userAchievement.isCompleted = true;
        userAchievement.completedAt = new Date();
      }

      await queryRunner.manager.save(userAchievement);
      await queryRunner.commitTransaction();

      // Emit event if completed
      if (userAchievement.isCompleted) {
        this.logger.log(
          `Achievement unlocked: User ${userId} unlocked ${achievement.name}`,
        );
        this.eventBus.publish(
          new AchievementUnlockedEvent(
            userId,
            achievement.id,
            achievement.name,
            achievement.rewardPoints,
            userAchievement.completedAt,
          ),
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to evaluate achievement ${achievement.id} for user ${userId}`,
        error.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if event payload satisfies achievement metadata conditions
   */
  private matchesCondition(
    achievement: Achievement,
    eventPayload: Record<string, any>,
  ): boolean {
    if (
      !achievement.metadata ||
      Object.keys(achievement.metadata).length === 0
    ) {
      return true; // No conditions
    }

    for (const [key, value] of Object.entries(achievement.metadata)) {
      if (eventPayload[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get detailed user progress for all achievements
   * Shows completion percentage and remaining requirements
   */
  async getUserProgress(userId: string): Promise<any[]> {
    const achievements = await this.achievementRepository.find({
      where: { isActive: true },
    });

    const userAchievements = await this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
    });

    const progressMap = new Map();
    userAchievements.forEach((ua) => {
      progressMap.set(ua.achievementId, ua);
    });

    return achievements.map((achievement) => {
      const userAchievement = progressMap.get(achievement.id);
      const currentProgress = userAchievement
        ? Number(userAchievement.currentProgress)
        : 0;
      const targetValue = Number(achievement.targetValue);
      const progressPercentage = Math.min(
        (currentProgress / targetValue) * 100,
        100,
      );
      const remaining = Math.max(targetValue - currentProgress, 0);

      return {
        achievementId: achievement.id,
        name: achievement.name,
        description: achievement.description,
        triggerEvent: achievement.triggerEvent,
        ruleType: achievement.ruleType,
        targetValue,
        currentProgress,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        remaining,
        isCompleted: userAchievement?.isCompleted || false,
        completedAt: userAchievement?.completedAt || null,
        rewardPoints: achievement.rewardPoints,
      };
    });
  }

  /**
   * Get achievements by category/trigger event
   */
  async getAchievementsByEvent(eventType: TriggerEvent): Promise<Achievement[]> {
    return this.achievementRepository.find({
      where: { triggerEvent: eventType, isActive: true },
    });
  }

  /**
   * Get recently unlocked achievements for a user
   */
  async getRecentAchievements(
    userId: string,
    limit: number = 10,
  ): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { userId, isCompleted: true },
      relations: ['achievement'],
      order: { completedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get user's achievement statistics
   */
  async getUserAchievementStats(userId: string): Promise<any> {
    const userAchievements = await this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
    });

    const total = userAchievements.length;
    const completed = userAchievements.filter((ua) => ua.isCompleted).length;
    const inProgress = total - completed;
    const totalRewardPoints = userAchievements
      .filter((ua) => ua.isCompleted)
      .reduce((sum, ua) => sum + (ua.achievement?.rewardPoints || 0), 0);

    return {
      total,
      completed,
      inProgress,
      totalRewardPoints,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }
}
