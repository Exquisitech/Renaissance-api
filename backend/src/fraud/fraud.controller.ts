import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FraudService } from './fraud.service';
import { RequireAdminRole } from '../auth/decorators/admin-roles.decorator';
import { AdminRole } from '../auth/enums/admin-role.enum';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateFraudStatusDto, FraudQueryDto, BlockUserDto } from './dto/fraud.dto';

@Controller('admin/fraud')
@UseGuards(AdminRoleGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  /**
   * GET /admin/fraud/logs
   * List fraud logs with optional filtering and pagination
   */
  @Get('logs')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.RISK_ADMIN)
  async getFraudLogs(@Query() query: FraudQueryDto) {
    return this.fraudService.getFraudLogs(query);
  }

  /**
   * GET /admin/fraud/logs/:id
   * Get a specific fraud log by ID
   */
  @Get('logs/:id')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.RISK_ADMIN)
  async getFraudLog(@Param('id') id: string) {
    return this.fraudService.getFraudLog(id);
  }

  /**
   * POST /admin/fraud/logs/:id/status
   * Update the review status of a specific fraud log
   */
  @Post('logs/:id/status')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async updateFraudLogStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFraudStatusDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.updateFraudRecordStatus(id, dto, admin.id);
  }

  /**
   * GET /admin/fraud/report
   * Generate comprehensive fraud report
   */
  @Get('report')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async generateReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.fraudService.generateFraudReport(start, end);
  }

  /**
   * GET /admin/fraud/suspicious-users
   * Get list of suspicious users
   */
  @Get('suspicious-users')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.SUPPORT)
  async getSuspiciousUsers() {
    return this.fraudService.getSuspiciousUsers();
  }

  /**
   * GET /admin/fraud/metrics
   * Get real-time fraud detection metrics
   */
  @Get('metrics')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getFraudMetrics() {
    return this.fraudService.getFraudMetrics();
  }

  /**
   * GET /admin/fraud/users/:userId/logs
   * Get all fraud logs for a specific user
   */
  @Get('users/:userId/logs')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST, AdminRole.RISK_ADMIN, AdminRole.SUPPORT)
  async getUserFraudLogs(@Param('userId') userId: string) {
    return this.fraudService.getUserFraudLogs(userId);
  }

  /**
   * POST /admin/fraud/users/:userId/review
   * Mark a user's open fraud flags for manual review
   */
  @Post('users/:userId/review')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async markForReview(
    @Param('userId') userId: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.markUserForReview(userId, admin.id);
  }

  /**
   * POST /admin/fraud/users/:userId/clear
   * Clear fraud flags for a user and reinstate their account
   */
  @Post('users/:userId/clear')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async clearFlags(
    @Param('userId') userId: string,
    @Body() body: { notes?: string },
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.clearUserFlags(userId, admin.id, body.notes);
  }

  /**
   * POST /admin/fraud/users/:userId/block
   * Manually block a user
   */
  @Post('users/:userId/block')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async blockUser(
    @Param('userId') userId: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.blockUser(userId, admin.id, dto.reason);
  }

  /**
   * POST /admin/fraud/users/:userId/unblock
   * Unblock a previously blocked user
   */
  @Post('users/:userId/unblock')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async unblockUser(
    @Param('userId') userId: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.fraudService.unblockUser(userId, admin.id);
  }
}
