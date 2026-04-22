import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Webhook, WebhookEvent } from './webhook.entity';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhookId: string;

  @ManyToOne(() => Webhook, (webhook) => webhook.subscriptions)
  @JoinColumn({ name: 'webhookId' })
  webhook: Webhook;

  @Column({
    type: 'enum',
    enum: WebhookEvent,
  })
  event: WebhookEvent;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}