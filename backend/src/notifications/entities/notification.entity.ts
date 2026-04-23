import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { NotificationType } from '../notifications.service';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

@Entity('notifications')
@Index(['userId', 'read', 'createdAt'])
@Index(['type', 'createdAt'])
export class NotificationEntity extends BaseEntity {
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'json', nullable: true })
  data?: Record<string, any>;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'varchar', default: 'medium' })
  priority: NotificationPriority;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
