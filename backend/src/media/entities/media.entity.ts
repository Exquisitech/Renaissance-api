import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export enum MediaStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('media')
@Index(['type'])
@Index(['status'])
@Index(['type', 'status'])
export class Media extends BaseEntity {
  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column()
  path: string;

  @Column({ nullable: true })
  url: string;

  @Column({
    type: 'enum',
    enum: MediaType,
  })
  type: MediaType;

  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.UPLOADING,
  })
  status: MediaStatus;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  alt: string;

  @Column({ nullable: true })
  caption: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  uploadedBy: User;
}
