import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { FraudService } from './fraud.service';
import { RequireAdminRole } from '../auth/decorators/admin-roles.decorator';
import { AdminRole } from '../auth/enums/admin-role.enum';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateFraudStatusDto, FraudQueryDto, BlockUserDto } from './dto/fraud.dto';
import { User } from '../users/entities/user.entity';
import { FraudLog } from './entities/fraud.entity';

export class MarkForReviewDto {
  @ApiProperty({
    description: 'Notes for the review',
    required: false,
    example: 'Multiple accounts from same IP detected',
  })
  notes?: string;
}

@ApiTags('Fraud Detection')
@Controller('admin/fraud')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('JWT-auth')
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('logs')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.RISK_ADMIN)
  @ApiOperation({
    summary: 'Get fraud logs',
    description:
      'Retrieves fraud detection logs with optional filtering by status, date range, and severity. Supports pagination.',
  })
  @ApiQuery({ type: FraudQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Fraud logs retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'log_123',
            userId: '456e7890-e12b-34d5-a678-901234567890',
            eventType: 'multiple_accounts',
            severity: 'high',
            status: 'pending',
            details: { ip: '192.168.1.1', matchingAccounts: 3 },
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 150,
        page: 1,
        limit: 50,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient admin privileges',
  })
  async getFraudLogs(@Query() query: FraudQueryDto) {
    return this.fraudService.getFraudLogs(query);
  }

  @Get('logs/:id')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.RISK_ADMIN)
  @ApiOperation({
    summary: 'Get specific fraud log',
    description: 'Retrieves detailed information about a specific fraud detection log',
  })
  @ApiParam({
    name: 'id',
    description: 'Fraud log ID',
    example: 'log_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud log found',
    schema: {
      example: {
        id: 'log_123',
        userId: '456e7890-e12b-34d5-a678-901234567890',
        eventType: 'multiple_accounts',
        severity: 'high',
        status: 'pending',
        details: {
          ip: '192.168.1.1',
          matchingAccounts: ['user1', 'user2', 'user3'],
          detectionMethod: 'ip_analysis',
        },
        reviewedBy: null,
        reviewedAt: null,
        notes: '',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Fraud log not found',
  })
  async getFraudLog(@Param('id') id: string) {
    return this.fraudService.getFraudLog(id);
  }

  @Post('logs/:id/status')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update fraud log status',
    description:
      'Updates the review status of a fraud detection log (pending, reviewing, resolved, false_positive)',
  })
  @ApiParam({
    name: 'id',
    description: 'Fraud log ID',
    example: 'log_123',
  })
  @ApiBody({ type: UpdateFraudStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Fraud log status updated',
    schema: {
      example: {
        success: true,
        message: 'Status updated to reviewing',
        logId: 'log_123',
        newStatus: 'reviewing',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid status transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Fraud log not found',
  })
  async updateFraudLogStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFraudStatusDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.updateFraudRecordStatus(id, dto, admin.id);
  }

  @Get('report')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  @ApiOperation({
    summary: 'Generate fraud report',
    description:
      'Generates comprehensive fraud report with metrics, trends, and top risk indicators for a date range',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud report generated',
    schema: {
      example: {
        period: '2024-01-01 to 2024-01-31',
        totalFlags: 250,
        bySeverity: { low: 100, medium: 100, high: 50 },
        byType: {
          multiple_accounts: 120,
          suspicious_betting: 80,
          unusual_winnings: 50,
        },
        resolutionStats: {
          confirmed: 80,
          false_positive: 100,
          pending: 70,
        },
        topRiskyUsers: [
          { userId: '456e...', riskScore: 95, flags: 5 },
        ],
      },
    },
  })
  async generateReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.fraudService.generateFraudReport(start, end);
  }

  @Get('suspicious-users')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.SUPPORT)
  @ApiOperation({
    summary: 'Get suspicious users list',
    description:
      'Retrieves users flagged for suspicious activity with risk scores and flag reasons',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Suspicious users retrieved',
    schema: {
      example: {
        data: [
          {
            id: '456e7890-e12b-34d5-a678-901234567890',
            email: 'suspicious@example.com',
            username: 'suspicious_user',
            riskScore: 85,
            flags: [
              { type: 'multiple_accounts', severity: 'high', createdAt: '2024-01-15T10:30:00Z' },
            ],
            totalBets: 500,
            totalWagered: 50000.0,
            flaggedAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 150,
        page: 1,
        limit: 50,
      },
    },
  })
  async getSuspiciousUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const users = await this.fraudService.getSuspiciousUsers();
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      data: users.slice(start, end),
      total: users.length,
      page,
      limit,
    };
  }

  @Get('metrics')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  @ApiOperation({
    summary: 'Get fraud detection metrics',
    description:
      'Real-time fraud detection metrics including detection rate, false positive rate, and active flags count',
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud metrics retrieved',
    schema: {
      example: {
        totalFlags: 150,
        activeFlags: 75,
        resolvedToday: 12,
        detectionRate: 92.5,
        falsePositiveRate: 5.2,
        averageResolutionTime: '4h 30m',
        bySource: {
          automated: 120,
          manual: 30,
        },
      },
    },
  })
  async getFraudMetrics() {
    return this.fraudService.getFraudMetrics();
  }

  @Get('users/:userId/logs')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.RISK_ADMIN, AdminRole.SUPPORT)
  @ApiOperation({
    summary: 'Get fraud logs for a user',
    description:
      'Retrieves all fraud detection records for a specific user, ordered by most recent',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'User fraud logs retrieved',
    schema: {
      example: [
        {
          id: 'log_123',
          eventType: 'multiple_accounts',
          severity: 'high',
          status: 'reviewing',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserFraudLogs(@Param('userId') userId: string) {
    return this.fraudService.getUserFraudLogs(userId);
  }

  @Post('users/:userId/review')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark user for manual review',
    description:
      'Flags a user for manual fraud review. This escalates the users account for admin attention.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiBody({ type: MarkForReviewDto })
  @ApiResponse({
    status: 200,
    description: 'User marked for review',
    schema: {
      example: {
        success: true,
        message: 'User marked for manual review',
        userId: '456e7890-e12b-34d5-a678-901234567890',
        flaggedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async markForReview(
    @Param('userId') userId: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: MarkForReviewDto,
  ) {
    return this.fraudService.markUserForReview(userId, admin.id, dto.notes);
  }

  @Post('users/:userId/clear')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear fraud flags',
    description:
      'Clears all fraud flags for a user and reinstates full account access. Requires documentation.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Optional notes about the clearance',
          example: 'False positive - manual review cleared',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Fraud flags cleared',
    schema: {
      example: {
        success: true,
        message: 'Fraud flags cleared and account reinstated',
        userId: '456e7890-e12b-34d5-a678-901234567890',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async clearFlags(
    @Param('userId') userId: string,
    @CurrentUser() admin: { id: string },
    @Body() body: { notes?: string },
  ) {
    return this.fraudService.clearUserFlags(userId, admin.id, body.notes);
  }

  @Post('users/:userId/block')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually block a user',
    description:
      'Manually blocks a user account from accessing the platform. This prevents login and all interactions.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiBody({ type: BlockUserDto })
  @ApiResponse({
    status: 200,
    description: 'User blocked successfully',
    schema: {
      example: {
        success: true,
        message: 'User account blocked',
        userId: '456e7890-e12b-34d5-a678-901234567890',
        blockedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async blockUser(
    @Param('userId') userId: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.blockUser(userId, admin.id, dto.reason);
  }

  @Post('users/:userId/unblock')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unblock a user',
    description: 'Removes a manual block from a user account, restoring full access.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'User unblocked successfully',
    schema: {
      example: {
        success: true,
        message: 'User account unblocked',
        userId: '456e7890-e12b-34d5-a678-901234567890',
        unblockedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async unblockUser(
    @Param('userId') userId: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.unblockUser(userId, admin.id);
  }
}
