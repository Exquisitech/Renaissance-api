import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  ManyToOne,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Post } from '../../posts/entities/post.entity';

export enum CategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Entity('categories')
@Index(['status'])
@Index(['slug'])
@Index(['parentId'])
export class Category extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  parentId: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({
    type: 'enum',
    enum: CategoryStatus,
    default: CategoryStatus.ACTIVE,
  })
  status: CategoryStatus;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToMany(() => Post, (post) => post.categories)
  @JoinTable({
    name: 'post_categories',
    joinColumn: {
      name: 'category_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'post_id',
      referencedColumnName: 'id',
    },
  })
  posts: Post[];

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
  })
  parent: Category;
}
