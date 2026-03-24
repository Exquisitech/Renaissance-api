import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Permission, AdminRole } from '../enums/admin-role.enum';
import { PermissionService } from '../services/permission.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { AssignRoleDto, RevokeRoleDto } from '../dto/admin-role.dto';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AdminRoleController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post('assign')
  @RequirePermissions(Permission.MANAGE_ADMINS)
  @ApiOperation({ summary: 'Assign admin role to user (Super Admin only)' })
  async assignRole(
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.permissionService.assignRole(
      dto.userId,
      dto.role,
      currentUser.id,
      dto.expiresAt,
      dto.notes,
    );
  }

  @Delete('revoke')
  @RequirePermissions(Permission.MANAGE_ADMINS)
  @ApiOperation({ summary: 'Revoke admin role from user (Super Admin only)' })
  async revokeRole(@Body() dto: RevokeRoleDto) {
    await this.permissionService.revokeRole(dto.userId, dto.role);
    return { message: 'Role revoked successfully' };
  }

  @Get('user/:userId')
  @RequirePermissions(Permission.MANAGE_ADMINS, Permission.VIEW_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get user admin roles' })
  async getUserRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    const roles = await this.permissionService.getUserRoles(userId);
    const permissions = await this.permissionService.getUserPermissions(userId);

    return {
      userId,
      roles,
      permissions: Array.from(permissions),
    };
  }

  @Get('permissions/:role')
  @RequirePermissions(Permission.MANAGE_ADMINS, Permission.VIEW_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get permissions for a specific role' })
  async getRolePermissions(@Param('role') role: AdminRole) {
    const permissions = await this.permissionService.getRolePermissions(role);
    return { role, permissions };
  }

  @Get('my-permissions')
  @ApiOperation({ summary: 'Get current user permissions' })
  async getMyPermissions(@CurrentUser() user: User) {
    const roles = await this.permissionService.getUserRoles(user.id);
    const permissions = await this.permissionService.getUserPermissions(
      user.id,
    );

    return {
      userId: user.id,
      roles,
      permissions: Array.from(permissions),
    };
  }

  @Get('all-permissions')
  @RequirePermissions(Permission.MANAGE_ADMINS)
  @ApiOperation({ summary: 'Get all available permissions' })
  async getAllPermissions() {
    return {
      permissions: Object.values(Permission),
      roles: Object.values(AdminRole),
    };
  }
}
