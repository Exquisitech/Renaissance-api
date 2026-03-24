import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/admin-role.enum';

export const PERMISSIONS_KEY = 'permissions';
export const REQUIRE_ALL_PERMISSIONS_KEY = 'require_all_permissions';

/**
 * Decorator to require specific permissions for a route
 * By default, user needs ANY of the specified permissions
 * Use @RequireAllPermissions() to require ALL permissions
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to require ALL specified permissions instead of ANY
 * Must be used together with @RequirePermissions()
 */
export const RequireAllPermissions = () =>
  SetMetadata(REQUIRE_ALL_PERMISSIONS_KEY, true);
