import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('moderation_logs')
export class ModerationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  commentId: string;

  @Column()
  adminId: string;

  @Column()
  action: string; // approved | removed

  @CreateDateColumn()
  createdAt: Date;
}