import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('stakes')
export class Stake {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  playerId!: string;

  @Column('decimal', { precision: 18, scale: 6 })
  amount!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  pendingRewards!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  totalClaimed!: number;

  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  compoundedAmount!: number;

  @Column({ default: true })
  active!: boolean;

  @Column({ nullable: true })
  stellarTxHash!: string; // hash from Stellar contract

  @Column({ nullable: true })
  unstakedAt!: Date;

  /** #357: Tier lock-up in days (0 = no lock) */
  @Column('int', { default: 0 })
  lockDays!: number;

  /** #357: Timestamp when lock expires */
  @Column({ nullable: true })
  lockedUntil!: Date;

  /** #357: APR applied to this stake (e.g. 0.12) */
  @Column('decimal', { precision: 5, scale: 4, default: 0.12 })
  apr!: number;

  /** #358: Auto-compound pending rewards instead of paying out */
  @Column({ default: false })
  autoCompound!: boolean;

  @CreateDateColumn()
  stakedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
