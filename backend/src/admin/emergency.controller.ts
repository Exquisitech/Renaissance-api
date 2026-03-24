import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  EmergencyPauseService,
  EmergencyPauseStatus,
} from './emergency-pause.service';

class EmergencyPauseDto {
  reason: string;
}

class EmergencyUnpauseDto {
  reason: string;
}

@ApiTags('Emergency Actions')
@Controller('admin/emergency')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class EmergencyController {
  constructor(private readonly emergencyPauseService: EmergencyPauseService) {}

  /**
   * Emergency pause all critical operations
   * POST /admin/emergency/pause
   * Requires ADMIN role
   */
  @Post('pause')
  @ApiOperation({
    summary: 'Emergency pause critical operations',
    description:
      'Immediately pause all critical operations. Requires ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Critical operations paused successfully',
    schema: {
      example: {
        success: true,
        action: 'paused',
        timestamp: '2026-01-22T10:30:00Z',
        pausedBy: 'user-id',
        reason: 'Security incident detected',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires ADMIN role',
  })
  async emergencyPause(
    @Body() dto: EmergencyPauseDto,
    @Req() req: Request,
  ): Promise<{
    success: boolean;
    action: string;
    status: EmergencyPauseStatus;
    timestamp: string | null;
    pausedBy: string;
    reason: string;
  }> {
    const userId = (req as any).user?.userId || (req as any).user?.id || null;
    const status = await this.emergencyPauseService.pause(dto.reason, userId);

    return {
      success: true,
      action: 'paused',
      status,
      timestamp: status.pausedAt,
      pausedBy: userId,
      reason: dto.reason,
    };
  }

  /**
   * Emergency unpause critical operations
   * POST /admin/emergency/unpause
   * Requires ADMIN role
   */
  @Post('unpause')
  @ApiOperation({
    summary: 'Emergency unpause critical operations',
    description:
      'Resume critical operations after emergency pause. Requires ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contracts unpaused successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires ADMIN role',
  })
  async emergencyUnpause(
    @Body() dto: EmergencyUnpauseDto,
    @Req() req: Request,
  ): Promise<{
    success: boolean;
    action: string;
    status: EmergencyPauseStatus;
    timestamp: string;
    unpausedBy: string;
    reason: string;
  }> {
    const userId = (req as any).user?.userId || (req as any).user?.id || null;
    const status = await this.emergencyPauseService.unpause(dto.reason, userId);

    return {
      success: true,
      action: 'unpaused',
      status,
      timestamp: new Date().toISOString(),
      unpausedBy: userId,
      reason: dto.reason,
    };
  }

  /**
   * Emergency freeze user account
   * POST /admin/emergency/freeze-user
   * Requires EMERGENCY_PAUSE or ADMIN role
   */
  @Post('freeze-user')
  @ApiOperation({
    summary: 'Emergency freeze user account',
    description:
      'Immediately freeze a user account and prevent all transactions. Requires EMERGENCY_PAUSE or ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'User account frozen successfully',
  })
  async emergencyFreezeUser(
    @Body() dto: { userId: string; reason: string },
    @Req() req: Request,
  ): Promise<{
    success: boolean;
    action: string;
    timestamp: string;
    frozenBy: string;
    userId: string;
    reason: string;
  }> {
    const adminId = (req as any).user?.id;

    // TODO: Implement user freeze logic

    return {
      success: true,
      action: 'emergency_freeze_user',
      timestamp: new Date().toISOString(),
      frozenBy: adminId,
      userId: dto.userId,
      reason: dto.reason,
    };
  }

  /**
   * Emergency status check
   * GET /admin/emergency/status
   * Check current emergency pause status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Emergency status check',
    description: 'Check the current global emergency pause status.',
  })
  async emergencyStatus(): Promise<{
    paused: boolean;
    pausedAt: string | null;
    pausedBy: string | null;
    reason: string | null;
  }> {
    return this.emergencyPauseService.getStatus();
  }
}
