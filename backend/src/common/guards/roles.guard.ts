import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

interface RequestUser {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Role hierarchy for privileged contract actions
 * Higher index = higher privileges
 */
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.USER,
  UserRole.MODERATOR,
  UserRole.ORACLE,
  UserRole.BACKEND_EXECUTOR,
  UserRole.EMERGENCY_PAUSE,
  UserRole.ADMIN,
];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: No role assigned');
    }

    // Check if user has any of the required roles (hierarchical check)
    const hasRole = this.hasRequiredRole(user.role, requiredRoles);

    if (!hasRole) {
      throw new ForbiddenException('Access denied: Insufficient permissions');
    }

    return true;
  }

  /**
   * Check if user role meets any of the required roles
   * Supports hierarchical role checking where higher roles can access lower role endpoints
   */
  private hasRequiredRole(
    userRole: UserRole,
    requiredRoles: UserRole[],
  ): boolean {
    // Direct match
    if (requiredRoles.includes(userRole)) {
      return true;
    }

    // Hierarchical check: higher roles can access endpoints requiring lower roles
    const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);

    for (const requiredRole of requiredRoles) {
      const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

      // If user role is higher in hierarchy than required role
      if (userRoleIndex > requiredRoleIndex) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a role is a privileged contract role
   */
  static isPrivilegedRole(role: UserRole): boolean {
    return [
      UserRole.ADMIN,
      UserRole.BACKEND_EXECUTOR,
      UserRole.ORACLE,
      UserRole.EMERGENCY_PAUSE,
    ].includes(role);
  }

  /**
   * Get role hierarchy level (higher number = more privileges)
   */
  static getRoleLevel(role: UserRole): number {
    return ROLE_HIERARCHY.indexOf(role);
  }
}
