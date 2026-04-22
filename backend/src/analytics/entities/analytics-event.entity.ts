import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum AnalyticsEventType {
  USER_LOGIN = 'user_login',
  USER_REGISTER = 'user_register',
  BET_PLACED = 'bet_placed',
  BET_SETTLED = 'bet_settled',
  SPIN_PLAYED = 'spin_played',
  NFT_PURCHASED = 'nft_purchased',
  PREDICTION_MADE = 'prediction_made',
  POST_CREATED = 'post_created',
  COMMENT_ADDED = 'comment_added',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  WALLET_TRANSACTION = 'wallet_transaction',
  PAGE_VIEW = 'page_view',
  FEATURE_USAGE = 'feature_usage',
}

export enum AnalyticsEventCategory {
  AUTHENTICATION = 'authentication',
  GAMBLING = 'gambling',
  SOCIAL = 'social',
  NFT = 'nft',
  PREDICTIONS = 'predictions',
  WALLET = 'wallet',
  ENGAGEMENT = 'engagement',
}

@Entity('analytics_events')
@Index(['userId', 'eventType', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['category', 'createdAt'])
export class AnalyticsEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: AnalyticsEventType,
  })
  eventType: AnalyticsEventType;

  @Column({
    type: 'enum',
    enum: AnalyticsEventCategory,
  })
  category: AnalyticsEventCategory;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sessionId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;
}