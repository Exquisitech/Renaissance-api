import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

export enum CommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELETED = 'deleted',
}

@Entity('comments')
export class Comment extends BaseEntity {
  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: CommentStatus,
    default: CommentStatus.PENDING,
  })
  status: CommentStatus;

  @Column({ default: 0 })
  likes: number;

  @Column({ nullable: true })
  parentId: string;

  @ManyToOne(() => User, (user) => user.comments, { onDelete: 'SET NULL' })
  author: User;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'SET NULL' })
  post: Post;

  @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true })
  parent: Comment;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];
}
