import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum RewardType {
  XLM_REWARD = 'XLM_REWARD',
  NFT_REWARD = 'NFT_REWARD',
  FREE_BET_REWARD = 'FREE_BET_REWARD',
  LOSS = 'LOSS',
}

export enum SpinStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('spin_games')
export class SpinGame extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 56 })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'stake_amount', type: 'decimal', precision: 20, scale: 7 })
  stakeAmount: number;

  @Column({ name: 'stake_asset', type: 'varchar', length: 10, default: 'XLM' })
  stakeAsset: string;

  @Column({
    name: 'reward_type',
    type: 'enum',
    enum: RewardType,
  })
  rewardType: RewardType;

  @Column({ name: 'reward_value', type: 'varchar' })
  rewardValue: string;

  @Column({
    name: 'win_amount',
    type: 'decimal',
    precision: 20,
    scale: 7,
    nullable: true,
  })
  winAmount: number | null;

  @Column({ name: 'spin_result', type: 'jsonb' })
  spinResult: {
    clientSeed: string;
    serverSeed: string;
    nonce: string;
    hash: string;
    randomValue: number;
    timestamp: string;
  };

  @Column({ type: 'text' })
  seed: string;

  @Column({
    type: 'enum',
    enum: SpinStatus,
    default: SpinStatus.COMPLETED,
  })
  status: SpinStatus;

  // ...BaseEntity fields: id, createdAt, updatedAt, deletedAt

  @Index()
  @Column({ name: 'is_suspicious', type: 'boolean', default: false })
  isSuspicious: boolean;

  @Index()
  @Column({ name: 'has_been_audited', type: 'boolean', default: false })
  hasBeenAudited: boolean;
}
