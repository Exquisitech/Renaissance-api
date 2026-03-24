import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AdminRole, Permission } from '../enums/admin-role.enum';

@Entity('role_permissions')
@Unique(['role', 'permission'])
@Index(['role'])
export class RolePermission extends BaseEntity {
  @Column({
    type: 'enum',
    enum: AdminRole,
  })
  role: AdminRole;

  @Column({
    type: 'enum',
    enum: Permission,
  })
  permission: Permission;

  @Column({ type: 'text', nullable: true })
  description: string;
}
