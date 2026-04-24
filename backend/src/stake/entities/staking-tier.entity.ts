import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('staking_tiers')
export class StakingTier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Lock-up duration in days */
  @Column('int')
  lockDays!: number;

  /** Annual Percentage Rate e.g. 0.12 = 12% */
  @Column('decimal', { precision: 5, scale: 4 })
  apr!: number;

  /** Early unstake penalty as a fraction of principal e.g. 0.05 = 5% */
  @Column('decimal', { precision: 5, scale: 4, default: 0.05 })
  earlyUnstakePenalty!: number;

  @Column({ default: true })
  active!: boolean;
}
