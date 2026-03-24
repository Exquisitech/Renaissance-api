import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

export const EMERGENCY_PAUSE_KEY = 'emergency_pause';

export interface EmergencyPauseMetadata {
  action: string;
  description: string;
  requiresConfirmation?: boolean;
}

/**
 * Guard for emergency pause actions on smart contracts
 * Only EMERGENCY_PAUSE and ADMIN roles can perform these actions
 */
@Injectable()
export class EmergencyPauseGuard implements CanActivate {
  private readonly logger = new Logger(EmergencyPauseGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const emergencyMetadata =
      this.reflector.getAllAndOverride<EmergencyPauseMetadata>(
        EMERGENCY_PAUSE_KEY,
        [context.getHandler(), context.getClass()],
      );

    // If no emergency metadata, allow access (not an emergency action)
    if (!emergencyMetadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      this.logger.warn(
        `Emergency action '${emergencyMetadata.action}' attempted without authentication`,
      );
      throw new ForbiddenException(
        'Access denied: Authentication required for emergency actions',
      );
    }

    // Only EMERGENCY_PAUSE and ADMIN can perform emergency actions
    const allowedRoles = [UserRole.EMERGENCY_PAUSE, UserRole.ADMIN];
    const hasEmergencyRole = allowedRoles.includes(user.role);

    if (!hasEmergencyRole) {
      this.logger.warn(
        `User ${user.userId} with role '${user.role}' attempted emergency action '${emergencyMetadata.action}'`,
      );
      throw new ForbiddenException(
        `Access denied: Emergency action '${emergencyMetadata.action}' requires EMERGENCY_PAUSE or ADMIN role`,
      );
    }

    // Log emergency action access
    this.logger.log(
      `Emergency action '${emergencyMetadata.action}' authorized for user ${user.userId} (${user.role})`,
    );

    // Store emergency action metadata in request for audit logging
    request.emergencyAction = {
      ...emergencyMetadata,
      executedBy: user.userId,
      executedAt: new Date().toISOString(),
    };

    return true;
  }
}
