// security/fraud.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudEntity, FraudReason, FraudStatus } from './entities/fraud.entity';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    @InjectRepository(FraudEntity)
    private readonly fraudRepo: Repository<FraudEntity>,
  ) {}

  /*
    PUBLIC ENTRY POINTS
  */

  async checkSpinActivity(userId: string) {
    await this.detectRapidSpin(userId);
  }

  async checkBetActivity(userId: string, amount: number) {
    await this.detectHighFrequencyBet(userId);
  }

  async checkWin(userId: string, isWin: boolean) {
    if (isWin) {
      await this.detectWinStreak(userId);
    }
  }

  /*
    DETECTION RULES
  */
  private spinTracker = new Map<string, number[]>();

  private async detectRapidSpin(userId: string) {
    const now = Date.now();

    if (!this.spinTracker.has(userId)) {
      this.spinTracker.set(userId, []);
    }

    const timestamps = this.spinTracker.get(userId);
    if (!timestamps) {
      this.spinTracker.set(userId, [now]);
      return;
    }

    timestamps.push(now);

    // Keep only last 10 seconds
    const filtered = timestamps.filter((t) => now - t < 10000);
    this.spinTracker.set(userId, filtered);

    if (filtered.length > 20) {
      await this.flagUser(userId, FraudReason.RAPID_SPIN, {
        spinsIn10Sec: filtered.length,
      });
    }
  }

  private betTracker = new Map<string, number[]>();

  private async detectHighFrequencyBet(userId: string) {
    const now = Date.now();

    if (!this.betTracker.has(userId)) {
      this.betTracker.set(userId, []);
    }

    const timestamps = this.betTracker.get(userId);
    if (!timestamps) {
      this.betTracker.set(userId, [now]);
      return;
    }

    timestamps.push(now);

    const filtered = timestamps.filter((t) => now - t < 30000);
    this.betTracker.set(userId, filtered);

    if (filtered.length > 50) {
      await this.flagUser(userId, FraudReason.HIGH_FREQUENCY_BET, {
        betsIn30Sec: filtered.length,
      });
    }
  }

  private winTracker = new Map<string, number>();

  private async detectWinStreak(userId: string) {
    const current = this.winTracker.get(userId) || 0;
    const newCount = current + 1;

    this.winTracker.set(userId, newCount);

    if (newCount >= 10) {
      await this.flagUser(userId, FraudReason.WIN_STREAK, {
        winStreak: newCount,
      });
    }
  }

  resetWinStreak(userId: string) {
    this.winTracker.set(userId, 0);
  }

  private async flagUser(
    userId: string,
    reason: FraudReason,
    metadata?: Record<string, any>,
  ) {
    this.logger.warn(`Fraud detected for user ${userId}: ${reason}`);

    // Log to DB
    await this.fraudRepo.save({
      userId,
      reason,
      metadata,
      status: FraudStatus.FLAGGED,
    });

    // OPTIONAL: Auto restriction logic
    const fraudCount = await this.fraudRepo.count({
      where: { userId },
    });

    if (fraudCount >= 3) {
      await this.restrictUser(userId);
    }
  }

  private async restrictUser(userId: string) {
    // Note: UserService not available - user restriction needs to be implemented
    // await this.userService.update(userId, {
    //   isRestricted: true,
    //   restrictedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    // });

    await this.fraudRepo.save({
      userId,
      reason: FraudReason.MANUAL_REVIEW,
      status: FraudStatus.RESTRICTED,
      metadata: {
        restrictedUntil: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    this.logger.error(`User ${userId} automatically restricted`);
  }
}
