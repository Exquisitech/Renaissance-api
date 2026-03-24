import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../services/permission.service';
import { Permission } from '../enums/admin-role.enum';
import {
  PERMISSIONS_KEY,
  REQUIRE_ALL_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const requireAll =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_ALL_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasPermission = requireAll
      ? await this.permissionService.hasAllPermissions(
          user.id,
          requiredPermissions,
        )
      : await this.permissionService.hasAnyPermission(
          user.id,
          requiredPermissions,
        );

    if (!hasPermission) {
      this.logger.warn(
        `User ${user.id} denied access. Required permissions: ${requiredPermissions.join(', ')}`,
      );
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    return true;
  }
}
