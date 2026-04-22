import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Webhook, WebhookEvent } from './webhook.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('webhook_delivery_logs')
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhookId: string;

  @ManyToOne(() => Webhook, (webhook) => webhook.deliveryLogs)
  @JoinColumn({ name: 'webhookId' })
  webhook: Webhook;

  @Column()
  subscriptionId: string;

  @Column({
    type: 'enum',
    enum: WebhookEvent,
  })
  event: WebhookEvent;

  @Column()
  payload: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ nullable: true })
  responseStatus: number;

  @Column({ nullable: true })
  responseBody: string;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ nullable: true })
  lastAttemptAt: Date;

  @Column({ nullable: true })
  nextRetryAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  signature: string;

  @Column({ nullable: true })
  duration: number;

  @CreateDateColumn()
  createdAt: Date;
}