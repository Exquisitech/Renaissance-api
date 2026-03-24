import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from '../entities/permission.entity';
import { AdminRoleEntity } from '../entities/admin-role.entity';
import { AdminRole, Permission } from '../enums/admin-role.enum';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private permissionCache: Map<AdminRole, Set<Permission>> = new Map();

  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(AdminRoleEntity)
    private readonly adminRoleRepo: Repository<AdminRoleEntity>,
  ) {
    this.initializeDefaultPermissions();
  }

  private async initializeDefaultPermissions(): Promise<void> {
    const defaultPermissions = this.getDefaultPermissions();

    for (const [role, permissions] of Object.entries(defaultPermissions)) {
      for (const permission of permissions) {
        const exists = await this.rolePermissionRepo.findOne({
          where: { role: role as AdminRole, permission },
        });

        if (!exists) {
          await this.rolePermissionRepo.save({
            role: role as AdminRole,
            permission,
          });
        }
      }
    }

    await this.loadPermissionsToCache();
  }

  private getDefaultPermissions(): Record<AdminRole, Permission[]> {
    return {
      [AdminRole.SUPER_ADMIN]: Object.values(Permission),

      [AdminRole.FINANCIAL_ADMIN]: [
        Permission.VIEW_TRANSACTIONS,
        Permission.PROCESS_WITHDRAWALS,
        Permission.ADJUST_BALANCES,
        Permission.VIEW_FINANCIAL_REPORTS,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.VIEW_AUDIT_LOGS,
      ],

      [AdminRole.RISK_ADMIN]: [
        Permission.VIEW_RISK_METRICS,
        Permission.SET_BET_LIMITS,
        Permission.EMERGENCY_PAUSE,
        Permission.OVERRIDE_LIMITS,
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_USERS,
        Permission.SUSPEND_USERS,
      ],

      [AdminRole.SUPPORT_ADMIN]: [
        Permission.VIEW_SUPPORT_TICKETS,
        Permission.RESPOND_TO_TICKETS,
        Permission.VIEW_USER_ACTIVITY,
        Permission.RESET_USER_PASSWORD,
        Permission.VIEW_USERS,
        Permission.MODERATE_CONTENT,
        Permission.VIEW_AUDIT_LOGS,
      ],
    };
  }

  private async loadPermissionsToCache(): Promise<void> {
    const allPermissions = await this.rolePermissionRepo.find();

    this.permissionCache.clear();

    for (const rolePermission of allPermissions) {
      if (!this.permissionCache.has(rolePermission.role)) {
        this.permissionCache.set(rolePermission.role, new Set());
      }
      this.permissionCache
        .get(rolePermission.role)!
        .add(rolePermission.permission);
    }

    this.logger.log('Permission cache loaded');
  }

  async getUserPermissions(userId: string): Promise<Set<Permission>> {
    const userRoles = await this.adminRoleRepo.find({
      where: { userId, active: true },
    });

    const permissions = new Set<Permission>();

    for (const userRole of userRoles) {
      // Check if role is expired
      if (userRole.expiresAt && new Date() > userRole.expiresAt) {
        continue;
      }

      const rolePermissions = this.permissionCache.get(userRole.role);
      if (rolePermissions) {
        rolePermissions.forEach((p) => permissions.add(p));
      }
    }

    return permissions;
  }

  async hasPermission(
    userId: string,
    permission: Permission,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has(permission);
  }

  async hasAnyPermission(
    userId: string,
    permissions: Permission[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some((p) => userPermissions.has(p));
  }

  async hasAllPermissions(
    userId: string,
    permissions: Permission[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every((p) => userPermissions.has(p));
  }

  async getUserRoles(userId: string): Promise<AdminRole[]> {
    const userRoles = await this.adminRoleRepo.find({
      where: { userId, active: true },
    });

    return userRoles
      .filter((ur) => !ur.expiresAt || new Date() <= ur.expiresAt)
      .map((ur) => ur.role);
  }

  async assignRole(
    userId: string,
    role: AdminRole,
    assignedBy: string,
    expiresAt?: Date,
    notes?: string,
  ): Promise<AdminRoleEntity> {
    const existing = await this.adminRoleRepo.findOne({
      where: { userId, role },
    });

    if (existing) {
      existing.active = true;
      existing.assignedBy = assignedBy;
      existing.assignedAt = new Date();
      existing.expiresAt = expiresAt as any;
      existing.notes = notes || existing.notes;
      return this.adminRoleRepo.save(existing);
    }

    const adminRole = this.adminRoleRepo.create({
      userId,
      role,
      assignedBy,
      expiresAt,
      notes,
      active: true,
    });

    return this.adminRoleRepo.save(adminRole);
  }

  async revokeRole(userId: string, role: AdminRole): Promise<void> {
    await this.adminRoleRepo.update({ userId, role }, { active: false });
  }

  async getRolePermissions(role: AdminRole): Promise<Permission[]> {
    const permissions = this.permissionCache.get(role);
    return permissions ? Array.from(permissions) : [];
  }

  async addPermissionToRole(
    role: AdminRole,
    permission: Permission,
  ): Promise<void> {
    const exists = await this.rolePermissionRepo.findOne({
      where: { role, permission },
    });

    if (!exists) {
      await this.rolePermissionRepo.save({ role, permission });
      await this.loadPermissionsToCache();
    }
  }

  async removePermissionFromRole(
    role: AdminRole,
    permission: Permission,
  ): Promise<void> {
    await this.rolePermissionRepo.delete({ role, permission });
    await this.loadPermissionsToCache();
  }
}
