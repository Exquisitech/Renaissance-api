// security/fraud.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  FraudEntity,
  FraudReason,
  FraudStatus,
  RiskLevel,
  RISK_SCORES,
} from './entities/fraud.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FraudQueryDto, UpdateFraudStatusDto } from './dto/fraud.dto';

interface UserActivity {
  timestamp: number;
  amount?: number;
  type?: string;
}

/** Cooldown windows (ms) per risk level to prevent duplicate flags */
const FLAG_COOLDOWN_MS: Record<RiskLevel, number> = {
  [RiskLevel.LOW]: 60 * 60 * 1000, // 1 hour
  [RiskLevel.MEDIUM]: 30 * 60 * 1000, // 30 minutes
  [RiskLevel.HIGH]: 10 * 60 * 1000, // 10 minutes
  [RiskLevel.CRITICAL]: 5 * 60 * 1000, // 5 minutes
};

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  // In-memory trackers for real-time detection
  private spinTracker = new Map<string, number[]>();
  private betTracker = new Map<string, number[]>();
  private winTracker = new Map<string, number>();
  private ipTracker = new Map<string, Set<string>>(); // IP -> Set of userIds
  private deviceTracker = new Map<string, Set<string>>(); // Device ID -> Set of userIds
  private userBetHistory = new Map<string, UserActivity[]>();
  private userTransactionHistory = new Map<string, UserActivity[]>();

  /**
   * False-positive guard: tracks last flag time per (userId + reason) key.
   * Prevents the same alert from flooding the system within a cooldown window.
   */
  private lastFlagTime = new Map<string, number>();

  constructor(
    @InjectRepository(FraudEntity)
    private readonly fraudRepo: Repository<FraudEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  /*
    PUBLIC ENTRY POINTS
  */

  async checkSpinActivity(userId: string) {
    await this.detectRapidSpin(userId);
  }

  async checkBetActivity(userId: string, amount: number) {
    await this.detectHighFrequencyBet(userId);
    await this.detectUnusualBettingPattern(userId, amount);
    await this.detectTimeBasedAnomaly(userId);
  }

  async checkWin(userId: string, isWin: boolean) {
    if (isWin) {
      await this.detectWinStreak(userId);
    } else {
      this.resetWinStreak(userId);
    }
  }

  async checkLogin(userId: string, ipAddress: string, deviceId?: string) {
    await this.detectMultiAccount(ipAddress, userId, deviceId);
  }

  async checkTransaction(userId: string, amount: number, type: string) {
    await this.detectSuspiciousTransaction(userId, amount, type);
    await this.detectStructuring(userId, amount);
  }

  /*
    MULTI-ACCOUNT DETECTION
  */
  private async detectMultiAccount(ipAddress: string, userId: string, deviceId?: string) {
    if (!this.ipTracker.has(ipAddress)) {
      this.ipTracker.set(ipAddress, new Set());
    }
    this.ipTracker.get(ipAddress)!.add(userId);

    const usersOnSameIP = this.ipTracker.get(ipAddress)!;
    
    if (usersOnSameIP.size > 3) {
      await this.flagUser(
        userId,
        FraudReason.SAME_IP_MULTIPLE_ACCOUNTS,
        {
          ipAddress,
          accountCount: usersOnSameIP.size,
          accounts: Array.from(usersOnSameIP),
        },
        RiskLevel.HIGH,
      );
    }

    if (deviceId) {
      if (!this.deviceTracker.has(deviceId)) {
        this.deviceTracker.set(deviceId, new Set());
      }
      this.deviceTracker.get(deviceId)!.add(userId);

      const usersOnSameDevice = this.deviceTracker.get(deviceId)!;
      
      if (usersOnSameDevice.size > 1) {
        await this.flagUser(
          userId,
          FraudReason.SAME_DEVICE_MULTIPLE_ACCOUNTS,
          {
            deviceId,
            accountCount: usersOnSameDevice.size,
            accounts: Array.from(usersOnSameDevice),
          },
          RiskLevel.CRITICAL,
        );
      }
    }
  }

  /*
    COLLUSION DETECTION
  */
  private async detectCollusion(userId: string, matchId: string, betAmount: number) {
    const recentBets = await this.betRepo.find({
      where: {
        matchId,
        createdAt: Between(new Date(Date.now() - 30 * 60 * 1000), new Date()), // Last 30 minutes
      },
      order: { createdAt: 'DESC' },
    });

    const coordinatedBets = recentBets.filter(bet => 
      bet.userId !== userId && 
      Math.abs(Number(bet.stakeAmount) - betAmount) < 10 // Similar bet amounts
    );

    if (coordinatedBets.length >= 3) {
      const involvedUsers = [userId, ...coordinatedBets.map(b => b.userId)];
      await this.flagUser(
        userId,
        FraudReason.COLLUSION_SUSPECTED,
        {
          matchId,
          coordinatedBetsCount: coordinatedBets.length,
          involvedUsers,
          timeWindow: '30min',
        },
        RiskLevel.HIGH,
      );
    }
  }

  /*
    UNUSUAL BETTING PATTERN DETECTION
  */
  private async detectUnusualBettingPattern(userId: string, amount: number) {
    // Track bet history
    if (!this.userBetHistory.has(userId)) {
      this.userBetHistory.set(userId, []);
    }
    
    const history = this.userBetHistory.get(userId)!;
    history.push({ timestamp: Date.now(), amount });
    
    // Keep only last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentHistory = history.filter(h => h.timestamp > oneHourAgo);
    this.userBetHistory.set(userId, recentHistory);

    if (recentHistory.length < 5) return;

    // Calculate average bet size
    const avgBet = recentHistory.reduce((sum, h) => sum + (h.amount || 0), 0) / recentHistory.length;
    
    // Detect sudden large bet (5x average)
    if (amount > avgBet * 5 && amount > 100) {
      await this.flagUser(
        userId,
        FraudReason.SUDDEN_LARGE_BET,
        {
          currentBet: amount,
          averageBet: avgBet.toFixed(2),
          multiplier: (amount / avgBet).toFixed(2),
        },
        RiskLevel.MEDIUM,
      );
    }

    // Detect abnormal increase pattern
    const recentBets = recentHistory.slice(-3);
    if (recentBets.length === 3) {
      const increasingPattern = recentBets.every((bet, i) => 
        i === 0 || bet.amount! > recentBets[i - 1].amount!
      );
      
      if (increasingPattern) {
        await this.flagUser(
          userId,
          FraudReason.ABNORMAL_BET_INCREASE,
          {
            recentBets: recentBets.map(b => b.amount),
          },
          RiskLevel.MEDIUM,
        );
      }
    }
  }

  /*
    TIME-BASED ANOMALY DETECTION
  */
  private async detectTimeBasedAnomaly(userId: string) {
    const now = new Date();
    const hour = now.getHours();
    
    // Unusual activity hours (2 AM - 5 AM local time)
    const isUnusualHour = hour >= 2 && hour <= 5;
    
    if (!this.userBetHistory.has(userId)) return;
    
    const recentActivity = this.userBetHistory.get(userId)!;
    const activityInLastHour = recentActivity.filter(
      a => Date.now() - a.timestamp < 60 * 60 * 1000
    ).length;

    if (isUnusualHour && activityInLastHour > 10) {
      await this.flagUser(
        userId,
        FraudReason.UNUSUAL_TIME_ACTIVITY,
        {
          hour,
          activityCount: activityInLastHour,
          isUnusualHour: true,
        },
        RiskLevel.LOW,
      );
    }

    // Detect rapid succession bets (< 2 seconds apart)
    if (recentActivity.length >= 2) {
      const lastTwo = recentActivity.slice(-2);
      const timeDiff = lastTwo[1].timestamp - lastTwo[0].timestamp;
      
      if (timeDiff < 2000) {
        await this.flagUser(
          userId,
          FraudReason.RAPID_SUCCESSION_BETS,
          {
            timeDifferenceMs: timeDiff,
          },
          RiskLevel.MEDIUM,
        );
      }
    }
  }

  /*
    SUSPICIOUS TRANSACTION DETECTION
  */
  private async detectSuspiciousTransaction(userId: string, amount: number, type: string) {
    if (!this.userTransactionHistory.has(userId)) {
      this.userTransactionHistory.set(userId, []);
    }

    const history = this.userTransactionHistory.get(userId)!;
    history.push({ timestamp: Date.now(), amount, type });

    // Keep last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentHistory = history.filter(h => h.timestamp > oneDayAgo);
    this.userTransactionHistory.set(userId, recentHistory);

    // Large transaction relative to user's wallet balance
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user && amount > Number(user.walletBalance) * 0.8 && amount > 500) {
      await this.flagUser(
        userId,
        FraudReason.SUSPICIOUS_TRANSACTION,
        {
          transactionAmount: amount,
          walletBalance: user.walletBalance,
          percentage: ((amount / Number(user.walletBalance)) * 100).toFixed(2),
          type,
        },
        RiskLevel.HIGH,
      );
    }
  }

  /*
    STRUCTURING DETECTION (avoiding reporting thresholds)
  */
  private async detectStructuring(userId: string, amount: number) {
    if (!this.userTransactionHistory.has(userId)) return;

    const recentHistory = this.userTransactionHistory.get(userId)!;
    const last24Hours = recentHistory.filter(
      h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000
    );

    // Multiple transactions just below threshold (e.g., multiple $900 transactions)
    const threshold = 1000;
    const nearThresholdTransactions = last24Hours.filter(
      h => h.amount && h.amount >= threshold * 0.8 && h.amount < threshold
    );

    if (nearThresholdTransactions.length >= 3) {
      const totalAmount = nearThresholdTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      
      await this.flagUser(
        userId,
        FraudReason.STRUCTURING_DETECTED,
        {
          transactionCount: nearThresholdTransactions.length,
          totalAmount,
          threshold,
          transactions: nearThresholdTransactions.map(t => t.amount),
        },
        RiskLevel.CRITICAL,
      );
    }
  }

  /*
    DETECTION RULES (Existing)
  */
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

  /*
    FLAGGING AND NOTIFICATION SYSTEM
  */
  private async flagUser(
    userId: string,
    reason: FraudReason,
    metadata?: Record<string, any>,
    riskLevel: RiskLevel = RiskLevel.MEDIUM,
  ) {
    // False-positive guard: skip if the same flag was emitted within the cooldown window
    const cooldownKey = `${userId}:${reason}`;
    const lastFlag = this.lastFlagTime.get(cooldownKey) ?? 0;
    const cooldown = FLAG_COOLDOWN_MS[riskLevel];
    if (Date.now() - lastFlag < cooldown) {
      return;
    }
    this.lastFlagTime.set(cooldownKey, Date.now());

    const riskScore = RISK_SCORES[reason] ?? 50;

    this.logger.warn(
      `Fraud detected for user ${userId}: ${reason} (Risk: ${riskLevel}, Score: ${riskScore})`,
    );

    // Persist fraud record
    const fraudRecord = await this.fraudRepo.save({
      userId,
      reason,
      metadata,
      status: FraudStatus.FLAGGED,
      riskLevel,
      riskScore,
    });

    // Auto-restrict user for HIGH / CRITICAL risk
    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      await this.restrictUser(userId, riskLevel);
      await this.notifyAdmin(fraudRecord);
    }

    // Escalate after repeated offences regardless of individual risk level
    const fraudCount = await this.fraudRepo.count({ where: { userId } });
    if (fraudCount >= 3 && riskLevel !== RiskLevel.HIGH && riskLevel !== RiskLevel.CRITICAL) {
      await this.restrictUser(userId, RiskLevel.HIGH);
    }
  }

  private async restrictUser(userId: string, riskLevel: RiskLevel) {
    const restrictedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Suspend the user account
    await this.userRepo.update(userId, { status: UserStatus.SUSPENDED });

    // Record the restriction event
    await this.fraudRepo.save({
      userId,
      reason: FraudReason.MANUAL_REVIEW,
      status: FraudStatus.RESTRICTED,
      riskLevel,
      riskScore: RISK_SCORES[FraudReason.MANUAL_REVIEW],
      metadata: {
        restrictedUntil,
        autoRestricted: true,
      },
    });

    this.logger.error(`User ${userId} automatically suspended (Risk: ${riskLevel})`);
  }

  private async notifyAdmin(fraudRecord: FraudEntity) {
    this.logger.warn(`ADMIN NOTIFICATION: High-risk fraud detected - ${fraudRecord.id}`, {
      userId: fraudRecord.userId,
      reason: fraudRecord.reason,
      riskLevel: fraudRecord.riskLevel,
      riskScore: fraudRecord.riskScore,
      metadata: fraudRecord.metadata,
    });
  }

  /*
    REPORT GENERATION
  */
  async generateFraudReport(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    const end = endDate || new Date();

    const fraudRecords = await this.fraudRepo.find({
      where: {
        createdAt: Between(start, end),
      },
      order: { createdAt: 'DESC' },
    });

    const report = {
      summary: {
        totalIncidents: fraudRecords.length,
        byRiskLevel: {
          low: fraudRecords.filter(r => r.riskLevel === RiskLevel.LOW).length,
          medium: fraudRecords.filter(r => r.riskLevel === RiskLevel.MEDIUM).length,
          high: fraudRecords.filter(r => r.riskLevel === RiskLevel.HIGH).length,
          critical: fraudRecords.filter(r => r.riskLevel === RiskLevel.CRITICAL).length,
        },
        byStatus: {
          flagged: fraudRecords.filter(r => r.status === FraudStatus.FLAGGED).length,
          underReview: fraudRecords.filter(r => r.status === FraudStatus.UNDER_REVIEW).length,
          restricted: fraudRecords.filter(r => r.status === FraudStatus.RESTRICTED).length,
          cleared: fraudRecords.filter(r => r.status === FraudStatus.CLEARED).length,
        },
        byReason: this.groupByReason(fraudRecords),
      },
      incidents: fraudRecords,
      topOffenders: await this.getTopOffenders(start, end),
      period: { start, end },
    };

    return report;
  }

  private groupByReason(records: FraudEntity[]) {
    return records.reduce((acc, record) => {
      acc[record.reason] = (acc[record.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getTopOffenders(start: Date, end: Date) {
    const query = await this.fraudRepo
      .createQueryBuilder('fraud')
      .select('fraud.userId', 'userId')
      .addSelect('COUNT(*)', 'incidentCount')
      .addSelect('MAX(fraud.riskLevel)', 'maxRiskLevel')
      .where('fraud.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('fraud.userId')
      .orderBy('incidentCount', 'DESC')
      .limit(10)
      .getRawMany();

    return query;
  }

  async getSuspiciousUsers() {
    const usersWithHighRisk = await this.fraudRepo
      .createQueryBuilder('fraud')
      .select('fraud.userId', 'userId')
      .addSelect('COUNT(*)', 'fraudCount')
      .addSelect('MAX(fraud.riskLevel)', 'maxRiskLevel')
      .addSelect('MAX(fraud.riskScore)', 'maxRiskScore')
      .where('fraud.status IN (:...statuses)', {
        statuses: [FraudStatus.FLAGGED, FraudStatus.RESTRICTED],
      })
      .groupBy('fraud.userId')
      .having('COUNT(*) >= 2')
      .orderBy('fraudCount', 'DESC')
      .getRawMany();

    return usersWithHighRisk;
  }

  /*
    ADMIN REVIEW SYSTEM
  */

  async getFraudLogs(query: FraudQueryDto) {
    const { userId, status, riskLevel, startDate, endDate, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const qb = this.fraudRepo.createQueryBuilder('fraud').orderBy('fraud.createdAt', 'DESC');

    if (userId) qb.andWhere('fraud.userId = :userId', { userId });
    if (status) qb.andWhere('fraud.status = :status', { status });
    if (riskLevel) qb.andWhere('fraud.riskLevel = :riskLevel', { riskLevel });
    if (startDate) qb.andWhere('fraud.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) qb.andWhere('fraud.createdAt <= :endDate', { endDate: new Date(endDate) });

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFraudLog(id: string) {
    const record = await this.fraudRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Fraud log ${id} not found`);
    return record;
  }

  async getUserFraudLogs(userId: string) {
    const records = await this.fraudRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const summary = {
      totalIncidents: records.length,
      activeFlags: records.filter(
        (r) => r.status === FraudStatus.FLAGGED || r.status === FraudStatus.RESTRICTED,
      ).length,
      maxRiskScore: records.reduce((max, r) => Math.max(max, r.riskScore), 0),
      reasons: [...new Set(records.map((r) => r.reason))],
    };

    return { summary, records };
  }

  async updateFraudRecordStatus(
    id: string,
    dto: UpdateFraudStatusDto,
    adminId: string,
  ) {
    const record = await this.getFraudLog(id);

    const updates: Partial<FraudEntity> = {
      status: dto.status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNotes: dto.reviewNotes,
    };

    if (dto.status === FraudStatus.CLEARED) {
      updates.resolvedAt = new Date();
    }

    await this.fraudRepo.update(id, updates);
    return this.getFraudLog(id);
  }

  async markUserForReview(userId: string, adminId: string) {
    const openRecords = await this.fraudRepo.find({
      where: {
        userId,
        status: In([FraudStatus.FLAGGED, FraudStatus.RESTRICTED]),
      },
    });

    if (openRecords.length === 0) {
      // Create a manual review entry
      const riskScore = RISK_SCORES[FraudReason.MANUAL_REVIEW];
      await this.fraudRepo.save({
        userId,
        reason: FraudReason.MANUAL_REVIEW,
        status: FraudStatus.UNDER_REVIEW,
        riskLevel: RiskLevel.MEDIUM,
        riskScore,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        metadata: { initiatedBy: adminId },
      });
    } else {
      await this.fraudRepo.update(
        openRecords.map((r) => r.id),
        {
          status: FraudStatus.UNDER_REVIEW,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      );
    }

    return { success: true, message: `User ${userId} marked for manual review` };
  }

  async clearUserFlags(userId: string, adminId: string, notes?: string) {
    const openRecords = await this.fraudRepo.find({
      where: {
        userId,
        status: In([FraudStatus.FLAGGED, FraudStatus.RESTRICTED, FraudStatus.UNDER_REVIEW]),
      },
    });

    if (openRecords.length > 0) {
      await this.fraudRepo.update(
        openRecords.map((r) => r.id),
        {
          status: FraudStatus.CLEARED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          resolvedAt: new Date(),
          reviewNotes: notes,
        },
      );
    }

    // Reinstate the user account
    await this.userRepo.update(userId, { status: UserStatus.ACTIVE });

    return {
      success: true,
      message: `Fraud flags cleared for user ${userId}`,
      clearedCount: openRecords.length,
    };
  }

  async blockUser(userId: string, adminId: string, reason?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    await this.userRepo.update(userId, { status: UserStatus.SUSPENDED });

    const riskScore = RISK_SCORES[FraudReason.MANUAL_REVIEW];
    await this.fraudRepo.save({
      userId,
      reason: FraudReason.MANUAL_REVIEW,
      status: FraudStatus.RESTRICTED,
      riskLevel: RiskLevel.HIGH,
      riskScore,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      metadata: { manualBlock: true, reason, blockedBy: adminId },
    });

    this.logger.warn(`User ${userId} manually blocked by admin ${adminId}`);
    return { success: true, message: `User ${userId} has been blocked` };
  }

  async unblockUser(userId: string, adminId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    await this.userRepo.update(userId, { status: UserStatus.ACTIVE });

    // Clear restriction records
    const restricted = await this.fraudRepo.find({
      where: { userId, status: FraudStatus.RESTRICTED },
    });
    if (restricted.length > 0) {
      await this.fraudRepo.update(
        restricted.map((r) => r.id),
        {
          status: FraudStatus.CLEARED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          resolvedAt: new Date(),
          reviewNotes: `Manually unblocked by admin ${adminId}`,
        },
      );
    }

    this.logger.log(`User ${userId} unblocked by admin ${adminId}`);
    return { success: true, message: `User ${userId} has been unblocked` };
  }

  async getFraudMetrics() {
    const [total, flagged, restricted, underReview, cleared] = await Promise.all([
      this.fraudRepo.count(),
      this.fraudRepo.count({ where: { status: FraudStatus.FLAGGED } }),
      this.fraudRepo.count({ where: { status: FraudStatus.RESTRICTED } }),
      this.fraudRepo.count({ where: { status: FraudStatus.UNDER_REVIEW } }),
      this.fraudRepo.count({ where: { status: FraudStatus.CLEARED } }),
    ]);

    const last24h = await this.fraudRepo.count({
      where: { createdAt: Between(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()) },
    });

    const criticalCount = await this.fraudRepo.count({
      where: { riskLevel: RiskLevel.CRITICAL },
    });

    return {
      totals: { total, flagged, restricted, underReview, cleared },
      last24Hours: last24h,
      criticalActive: criticalCount,
      activeMonitors: {
        ipTracking: true,
        deviceTracking: true,
        betPatternAnalysis: true,
        transactionMonitoring: true,
        collusionDetection: true,
        falsePosiotiveGuard: true,
      },
      lastUpdated: new Date(),
    };
  }
}
