import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';

export const CONTRACT_ROLES_KEY = 'contract_roles';

/**
 * Metadata for contract role requirements
 */
export interface ContractRoleMetadata {
  roles: UserRole[];
  action: string;
  requireAll?: boolean;
}

/**
 * Decorator to mark endpoints that require specific contract roles
 * Used for blockchain settlement, oracle updates, and emergency actions
 */
export const RequireContractRoles = (
  roles: UserRole[],
  action: string,
  options?: { requireAll?: boolean },
) => {
  return SetMetadata(CONTRACT_ROLES_KEY, {
    roles,
    action,
    requireAll: options?.requireAll ?? false,
  });
};

/**
 * Combined decorator for contract endpoints requiring privileged roles
 * Automatically applies JWT auth, role guards, and Swagger documentation
 */
export const ContractAction = (
  roles: UserRole[],
  action: string,
  options?: { requireAll?: boolean },
) => {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    RequireContractRoles(roles, action, options),
    ApiBearerAuth('JWT-auth'),
    ApiForbiddenResponse({
      description: 'Insufficient permissions for this contract action',
      schema: {
        example: {
          statusCode: 403,
          message:
            'Access denied: Insufficient permissions for contract action',
          error: 'Forbidden',
          requiredRoles: roles,
          action,
        },
      },
    }),
  );
};

/**
 * Decorator for Oracle-specific actions (price feeds, match results)
 */
export const OracleAction = (action: string) => {
  return ContractAction([UserRole.ORACLE], action);
};

/**
 * Decorator for Backend Executor actions (settlements, batch operations)
 */
export const BackendExecutorAction = (action: string) => {
  return ContractAction([UserRole.BACKEND_EXECUTOR], action);
};

/**
 * Decorator for Emergency Pause actions (contract pause/unpause)
 */
export const EmergencyPauseAction = (action: string) => {
  return ContractAction([UserRole.EMERGENCY_PAUSE], action);
};

/**
 * Decorator for Admin contract actions (full access)
 */
export const AdminContractAction = (action: string) => {
  return ContractAction([UserRole.ADMIN], action);
};

/**
 * Decorator for any privileged contract role
 */
export const PrivilegedContractAction = (action: string) => {
  return ContractAction(
    [
      UserRole.ADMIN,
      UserRole.BACKEND_EXECUTOR,
      UserRole.ORACLE,
      UserRole.EMERGENCY_PAUSE,
    ],
    action,
  );
};
