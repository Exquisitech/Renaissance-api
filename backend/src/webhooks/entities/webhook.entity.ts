import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookDeliveryLog } from './webhook-delivery-log.entity';

export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused',
}

export enum WebhookEvent {
  // Betting events
  BET_PLACED = 'bet.placed',
  BET_SETTLED = 'bet.settled',
  BET_CANCELLED = 'bet.cancelled',
  
  // Transaction events
  DEPOSIT_COMPLETED = 'deposit.completed',
  WITHDRAWAL_COMPLETED = 'withdrawal.completed',
  WITHDRAWAL_FAILED = 'withdrawal.failed',
  
  // User events
  USER_REGISTERED = 'user.registered',
  USER_KYC_APPROVED = 'user.kyc.approved',
  USER_KYC_REJECTED = 'user.kyc.rejected',
  
  // Game events
  JACKPOT_WIN = 'jackpot.win',
  SPIN_COMPLETED = 'spin.completed',
  
  // Admin events
  EMERGENCY_PAUSE = 'emergency.pause',
  EMERGENCY_UNPAUSE = 'emergency.unpause',
  
  // System events
  SYSTEM_ALERT = 'system.alert',
}

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  url: string;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  secret: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: 3 })
  retryAttempts: number;

  @Column({ default: 1000 })
  timeoutMs: number;

  @Column({ nullable: true })
  lastHealthCheck: Date;

  @Column({ default: true })
  healthStatus: boolean;

  @OneToMany(() => WebhookSubscription, (subscription) => subscription.webhook)
  subscriptions: WebhookSubscription[];

  @OneToMany(() => WebhookDeliveryLog, (log) => log.webhook)
  deliveryLogs: WebhookDeliveryLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}