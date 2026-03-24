import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { UserRole, User } from '../../users/entities/user.entity';
import {
  RoleManagementService,
  RoleAssignmentResult,
} from '../services/role-management.service';
import type { Request } from 'express';

class AssignRoleDto {
  userId: string;
  role: UserRole;
}

class BulkAssignRoleDto {
  userIds: string[];
  role: UserRole;
}

@ApiTags('Role Management')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class RoleManagementController {
  constructor(private readonly roleManagementService: RoleManagementService) {}

  /**
   * Assign a role to a specific user
   * POST /admin/roles/assign
   */
  @Post('assign')
  @ApiOperation({
    summary: 'Assign role to user',
    description:
      'Assign a specific role to a user. Only ADMIN can assign privileged roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Role assigned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions to assign this role',
  })
  async assignRole(
    @Body() dto: AssignRoleDto,
    @Req() req: Request,
  ): Promise<RoleAssignmentResult> {
    const adminId = (req as any).user?.id;
    return this.roleManagementService.assignRole(dto.userId, dto.role, adminId);
  }

  /**
   * Bulk assign role to multiple users
   * POST /admin/roles/assign/bulk
   */
  @Post('assign/bulk')
  @ApiOperation({
    summary: 'Bulk assign role to users',
    description: 'Assign a role to multiple users at once',
  })
  async bulkAssignRole(
    @Body() dto: BulkAssignRoleDto,
    @Req() req: Request,
  ): Promise<RoleAssignmentResult[]> {
    const adminId = (req as any).user?.id;
    return this.roleManagementService.bulkAssignRole(
      dto.userIds,
      dto.role,
      adminId,
    );
  }

  /**
   * Revoke privileged role from user
   * POST /admin/roles/revoke/:userId
   */
  @Post('revoke/:userId')
  @ApiParam({ name: 'userId', description: 'User ID to revoke role from' })
  @ApiOperation({
    summary: 'Revoke privileged role',
    description: 'Revoke privileged role from user and revert to USER role',
  })
  async revokePrivilegedRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: Request,
  ): Promise<RoleAssignmentResult> {
    const adminId = (req as any).user?.id;
    return this.roleManagementService.revokePrivilegedRole(userId, adminId);
  }

  /**
   * Get all users with a specific role
   * GET /admin/roles/users?role=oracle
   */
  @Get('users')
  @ApiOperation({
    summary: 'Get users by role',
    description: 'Get all users with a specific role',
  })
  async getUsersByRole(@Query('role') role: UserRole): Promise<User[]> {
    return this.roleManagementService.getUsersByRole(role);
  }

  /**
   * Get all privileged users
   * GET /admin/roles/privileged-users
   */
  @Get('privileged-users')
  @ApiOperation({
    summary: 'Get all privileged users',
    description: 'Get all users with privileged contract roles',
  })
  async getPrivilegedUsers(): Promise<User[]> {
    return this.roleManagementService.getPrivilegedUsers();
  }

  /**
   * Get role statistics
   * GET /admin/roles/statistics
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get role distribution statistics',
    description: 'Get count of users per role',
  })
  async getRoleStatistics(): Promise<Record<UserRole, number>> {
    const stats: Record<UserRole, number> = {
      [UserRole.USER]: 0,
      [UserRole.MODERATOR]: 0,
      [UserRole.ORACLE]: 0,
      [UserRole.BACKEND_EXECUTOR]: 0,
      [UserRole.EMERGENCY_PAUSE]: 0,
      [UserRole.ADMIN]: 0,
    };

    for (const role of Object.values(UserRole)) {
      const users = await this.roleManagementService.getUsersByRole(role);
      stats[role] = users.length;
    }

    return stats;
  }
}
