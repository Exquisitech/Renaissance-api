import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Category } from '../../categories/entities/category.entity';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum PostType {
  ARTICLE = 'article',
  TUTORIAL = 'tutorial',
  NEWS = 'news',
  BLOG = 'blog',
}

@Entity('posts')
export class Post extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  excerpt: string;

  @Column({ nullable: true })
  slug: string;

  @Column({ nullable: true })
  featuredImage: string;

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @Column({
    type: 'enum',
    enum: PostType,
    default: PostType.ARTICLE,
  })
  type: PostType;

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  likes: number;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  seoTitle: string;

  @Column({ nullable: true })
  seoDescription: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'SET NULL' })
  author: User;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @ManyToMany(() => Category, (category) => category.posts)
  @JoinTable({
    name: 'post_categories',
    joinColumn: {
      name: 'post_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'category_id',
      referencedColumnName: 'id',
    },
  })
  categories: Category[];
}
