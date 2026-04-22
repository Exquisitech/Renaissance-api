import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { FlagReason } from '../enums/flag-reason.enum';

@Entity('comment_flags')
export class CommentFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  commentId: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: FlagReason,
  })
  reason: FlagReason;

  @CreateDateColumn()
  createdAt: Date;
}