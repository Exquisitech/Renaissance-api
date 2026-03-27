// security/fraud.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FraudEntity, FraudReason, FraudStatus, RiskLevel } from './entities/fraud.entity';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

interface UserActivity {
  timestamp: number;
  amount?: number;
  type?: string;
}

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
    this.logger.warn(`Fraud detected for user ${userId}: ${reason} (Risk: ${riskLevel})`);

    // Log to DB
    const fraudRecord = await this.fraudRepo.save({
      userId,
      reason,
      metadata,
      status: FraudStatus.FLAGGED,
      riskLevel,
    });

    // Auto-restriction for high/critical risk
    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      await this.restrictUser(userId, riskLevel);
    }

    // Send admin notification for high-risk activities
    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      await this.notifyAdmin(fraudRecord);
    }

    // Check for repeated offenses
    const fraudCount = await this.fraudRepo.count({
      where: { userId },
    });

    if (fraudCount >= 3 && riskLevel !== RiskLevel.CRITICAL) {
      await this.restrictUser(userId, RiskLevel.HIGH);
    }
  }

  private async restrictUser(userId: string, riskLevel: RiskLevel) {
    await this.fraudRepo.save({
      userId,
      reason: FraudReason.MANUAL_REVIEW,
      status: FraudStatus.RESTRICTED,
      riskLevel,
      metadata: {
        restrictedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        autoRestricted: true,
      },
    });

    this.logger.error(`User ${userId} automatically restricted (Risk: ${riskLevel})`);
  }

  private async notifyAdmin(fraudRecord: FraudEntity) {
    // This would integrate with your notification system
    // For now, log the notification event
    this.logger.warn(`ADMIN NOTIFICATION: High-risk fraud detected - ${fraudRecord.id}`, {
      userId: fraudRecord.userId,
      reason: fraudRecord.reason,
      riskLevel: fraudRecord.riskLevel,
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
      .where('fraud.status IN (:...statuses)', { 
        statuses: [FraudStatus.FLAGGED, FraudStatus.RESTRICTED] 
      })
      .groupBy('fraud.userId')
      .having('COUNT(*) >= 2')
      .orderBy('fraudCount', 'DESC')
      .getRawMany();

    return usersWithHighRisk;
  }
}
