import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Expose } from 'class-transformer';

export enum JackpotStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLAIMED = 'CLAIMED',
  EXPIRED = 'EXPIRED',
}

export enum JackpotTier {
  MINI = 'MINI',
  MAJOR = 'MAJOR',
  MEGA = 'MEGA',
  GRAND = 'GRAND',
}

/**
 * Jackpot entity that tracks accumulated jackpot pools
 */
@Entity('spin_jackpot')
export class SpinJackpot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tier: JackpotTier;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  currentAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  minimumAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  maximumAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  contributionPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  @Expose()
  triggerProbability: number;

  @Column({ type: 'int', default: 0 })
  minSpinsToTrigger: number;

  @Column({ type: 'int', default: 0 })
  @Expose()
  totalTriggers: number;

  @Column({ type: 'int', default: 0 })
  @Expose()
  totalWins: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  totalPaidOut: number;

  @Column({ type: 'enum', enum: JackpotStatus, default: JackpotStatus.ACTIVE })
  status: JackpotStatus;

  @Column({ type: 'timestamp', nullable: true })
  @Expose()
  lastWinDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUpdated: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Tracks individual jackpot wins
 */
@Entity('spin_jackpot_winner')
export class SpinJackpotWinner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  jackpotId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  spinId: string;

  @Column({ type: 'varchar', length: 50 })
  jackpotTier: JackpotTier;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  @Expose()
  wonAmount: number;

  @Column({ type: 'boolean', default: false })
  claimed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * Tracks jackpot contribution history
 */
@Entity('spin_jackpot_contribution')
export class SpinJackpotContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'uuid' })
  spinId: string;

  @Column({ type: 'varchar', length: 50 })
  jackpotTier: JackpotTier;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  contributionAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  stakeAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentageContributed: number;

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * Global jackpot statistics
 */
@Entity('spin_jackpot_stats')
export class SpinJackpotStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  totalPoolAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  totalContributions: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  @Expose()
  totalPayouts: number;

  @Column({ type: 'int', default: 0 })
  @Expose()
  totalWins: number;

  @Column({ type: 'int', default: 0 })
  totalSpinsContributed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageContributionPercent: number;

  @Column({ type: 'timestamp', nullable: true })
  lastWinDate: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lastWinningTier: string;

  @UpdateDateColumn()
  updatedAt: Date;
}