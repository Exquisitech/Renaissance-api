import { Entity, Column, Index, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export enum MetricType {
  REVENUE = 'revenue',
  BET_VOLUME = 'bet_volume',
  USER_ACTIVITY = 'user_activity',
  JACKPOT = 'jackpot',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
}

export enum TimeGranularity {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('admin_analytics_metrics')
@Index(['metricType', 'granularity', 'date'])
export class AdminAnalyticsMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MetricType })
  metricType: MetricType;

  @Column({ type: 'enum', enum: TimeGranularity })
  granularity: TimeGranularity;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int', nullable: true })
  hour: number | null;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  value: number;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  previousValue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  changePercent: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('admin_revenue_analytics')
export class AdminRevenueAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  totalStaked: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  totalPayout: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  netRevenue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  spinGameRevenue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  betRevenue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  jackpotPayout: number;

  @Column({ type: 'int', default: 0 })
  totalTransactions: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  payoutRate: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('admin_user_activity')
export class AdminUserActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int', default: 0 })
  totalUsers: number;

  @Column({ type: 'int', default: 0 })
  activeUsers: number;

  @Column({ type: 'int', default: 0 })
  newUsers: number;

  @Column({ type: 'int', default: 0 })
  returningUsers: number;

  @Column({ type: 'int', default: 0 })
  inactiveUsers: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  activeRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  retentionRate: number;

  @Column({ type: 'int', default: 0 })
  totalSessions: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgSessionDuration: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('admin_geographical_stats')
@Index(['countryCode'])
export class AdminGeographicalStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 3 })
  countryCode: string;

  @Column({ type: 'varchar', length: 100 })
  countryName: string;

  @Column({ type: 'int', default: 0 })
  userCount: number;

  @Column({ type: 'int', default: 0 })
  activeUsers: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  totalStaked: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  totalRevenue: number;

  @Column({ type: 'int', default: 0 })
  transactionCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('admin_trend_analysis')
@Index(['metricName', 'date'])
export class AdminTrendAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  metricName: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  currentValue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  previousValue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  value7DaysAgo: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  value30DaysAgo: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  dailyChange: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  weeklyChange: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  monthlyChange: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  movingAverage7Days: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  movingAverage30Days: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('admin_bet_volume')
@Index(['date', 'granularity'])
export class AdminBetVolume {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int', nullable: true })
  hour: number | null;

  @Column({ type: 'enum', enum: TimeGranularity })
  granularity: TimeGranularity;

  @Column({ type: 'int', default: 0 })
  totalBets: number;

  @Column({ type: 'int', default: 0 })
  spinGames: number;

  @Column({ type: 'int', default: 0 })
  sportsBets: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  totalVolume: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  spinGameVolume: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  sportsBetVolume: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  avgBetSize: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  maxBetSize: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  minBetSize: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('admin_real_time_metrics')
export class AdminRealTimeMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  metricKey: string;

  @Column({ type: 'int', default: 0 })
  currentValue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  currentAmount: number;

  @Column({ type: 'int', default: 0 })
  minValue: number;

  @Column({ type: 'int', default: 0 })
  maxValue: number;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  avgValue: number;

  @Column({ type: 'timestamp' })
  lastUpdated: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}