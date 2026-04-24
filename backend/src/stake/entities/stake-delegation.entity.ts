import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Delegator earns 1% of delegatee's staking rewards */
@Entity('stake_delegations')
export class StakeDelegation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The user who delegates their stake */
  @Column('uuid')
  delegatorId!: string;

  /** The respected bettor receiving the delegated stake */
  @Column('uuid')
  delegateeId!: string;

  @Column('decimal', { precision: 18, scale: 6 })
  amount!: number;

  @Column({ default: true })
  active!: boolean;

  /** Cumulative rewards earned by delegator (1% of delegatee rewards) */
  @Column('decimal', { precision: 18, scale: 6, default: 0 })
  earnedRewards!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
