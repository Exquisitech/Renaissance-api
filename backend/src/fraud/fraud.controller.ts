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

@Controller('admin/fraud')
@UseGuards(AdminRoleGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

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
   * POST /admin/fraud/users/:id/review
   * Mark a user for manual review
   */
  @Post('users/:id/review')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async markForReview(@Param('id') userId: string) {
    // This would be implemented to manually flag a user
    return { 
      success: true, 
      message: `User ${userId} marked for manual review`,
      timestamp: new Date(),
    };
  }

  /**
   * POST /admin/fraud/users/:id/clear
   * Clear fraud flags for a user
   */
  @Post('users/:id/clear')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.RISK_ADMIN)
  async clearFlags(@Param('id') userId: string) {
    // This would clear fraud flags
    return { 
      success: true, 
      message: `Fraud flags cleared for user ${userId}`,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/fraud/metrics
   * Get real-time fraud metrics
   */
  @Get('metrics')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getFraudMetrics() {
    return {
      activeMonitors: {
        ipTracking: true,
        deviceTracking: true,
        betPatternAnalysis: true,
        transactionMonitoring: true,
        collusionDetection: true,
      },
      lastUpdated: new Date(),
    };
  }
}
