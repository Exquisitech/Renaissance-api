import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';

export interface RoleAssignmentResult {
  success: boolean;
  userId: string;
  previousRole: UserRole;
  newRole: UserRole;
  assignedBy: string;
  assignedAt: Date;
}

export interface RoleValidationResult {
  valid: boolean;
  userId: string;
  role: UserRole;
  hasPrivilegedAccess: boolean;
}

@Injectable()
export class RoleManagementService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Assign a role to a user
   * Only ADMIN can assign privileged roles (BACKEND_EXECUTOR, ORACLE, EMERGENCY_PAUSE)
   */
  async assignRole(
    targetUserId: string,
    newRole: UserRole,
    assignedByUserId: string,
  ): Promise<RoleAssignmentResult> {
    // Verify the assigning user exists and has permission
    const assigningUser = await this.userRepository.findOne({
      where: { id: assignedByUserId },
    });

    if (!assigningUser) {
      throw new NotFoundException('Assigning user not found');
    }

    // Only ADMIN can assign privileged contract roles
    if (
      this.isPrivilegedRole(newRole) &&
      assigningUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only ADMIN can assign privileged contract roles',
      );
    }

    // ADMIN can assign any role, MODERATOR can only assign USER/MODERATOR
    if (
      assigningUser.role === UserRole.MODERATOR &&
      newRole !== UserRole.USER
    ) {
      throw new ForbiddenException('MODERATOR can only assign USER role');
    }

    // Get target user
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const previousRole = targetUser.role;

    // Update role
    targetUser.role = newRole;
    await this.userRepository.save(targetUser);

    return {
      success: true,
      userId: targetUserId,
      previousRole,
      newRole,
      assignedBy: assignedByUserId,
      assignedAt: new Date(),
    };
  }

  /**
   * Bulk assign role to multiple users
   */
  async bulkAssignRole(
    targetUserIds: string[],
    newRole: UserRole,
    assignedByUserId: string,
  ): Promise<RoleAssignmentResult[]> {
    const results: RoleAssignmentResult[] = [];

    for (const userId of targetUserIds) {
      try {
        const result = await this.assignRole(userId, newRole, assignedByUserId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          userId,
          previousRole: null as any,
          newRole,
          assignedBy: assignedByUserId,
          assignedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Revoke a privileged role from a user
   */
  async revokePrivilegedRole(
    targetUserId: string,
    revokedByUserId: string,
  ): Promise<RoleAssignmentResult> {
    const revokingUser = await this.userRepository.findOne({
      where: { id: revokedByUserId },
    });

    if (!revokingUser || revokingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can revoke privileged roles');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const previousRole = targetUser.role;

    // Revert to standard USER role
    targetUser.role = UserRole.USER;
    await this.userRepository.save(targetUser);

    return {
      success: true,
      userId: targetUserId,
      previousRole,
      newRole: UserRole.USER,
      assignedBy: revokedByUserId,
      assignedAt: new Date(),
    };
  }

  /**
   * Validate if a user has a specific role
   */
  async validateUserRole(
    userId: string,
    requiredRole: UserRole,
  ): Promise<RoleValidationResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return {
        valid: false,
        userId,
        role: null as any,
        hasPrivilegedAccess: false,
      };
    }

    const hasPrivilegedAccess = this.isPrivilegedRole(user.role);

    return {
      valid: user.role === requiredRole,
      userId,
      role: user.role,
      hasPrivilegedAccess,
    };
  }

  /**
   * Check if user has any of the required roles
   */
  async validateUserHasAnyRole(
    userId: string,
    requiredRoles: UserRole[],
  ): Promise<RoleValidationResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return {
        valid: false,
        userId,
        role: null as any,
        hasPrivilegedAccess: false,
      };
    }

    const hasPrivilegedAccess = this.isPrivilegedRole(user.role);
    const valid = requiredRoles.includes(user.role);

    return {
      valid,
      userId,
      role: user.role,
      hasPrivilegedAccess,
    };
  }

  /**
   * Get all users with a specific role
   */
  async getUsersByRole(role: UserRole): Promise<User[]> {
    return this.userRepository.find({
      where: { role },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
    });
  }

  /**
   * Get all users with privileged contract access
   */
  async getPrivilegedUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: [
        { role: UserRole.ADMIN },
        { role: UserRole.BACKEND_EXECUTOR },
        { role: UserRole.ORACLE },
        { role: UserRole.EMERGENCY_PAUSE },
      ],
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
    });
  }

  /**
   * Check if a role is a privileged contract role
   */
  private isPrivilegedRole(role: UserRole): boolean {
    return [
      UserRole.ADMIN,
      UserRole.BACKEND_EXECUTOR,
      UserRole.ORACLE,
      UserRole.EMERGENCY_PAUSE,
    ].includes(role);
  }
}
