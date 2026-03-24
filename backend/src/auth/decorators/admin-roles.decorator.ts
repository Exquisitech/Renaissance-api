import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../enums/admin-role.enum';

export const ADMIN_ROLES_KEY = 'admin_roles';

/**
 * Decorator to require specific admin roles for a route
 * User must have at least one of the specified admin roles
 */
export const RequireAdminRole = (...roles: AdminRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
