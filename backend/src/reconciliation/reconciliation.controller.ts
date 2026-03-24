import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import {
  ReconciliationService,
  PaginatedReports,
  ReportSummary,
} from './reconciliation.service';
import { ReconciliationScheduler } from './reconciliation.scheduler';
import {
  ReconciliationReport,
  ReportType,
  Inconsistency,
} from './entities/reconciliation-report.entity';

@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BACKEND_EXECUTOR)
@ApiBearerAuth('JWT-auth')
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly reconciliationScheduler: ReconciliationScheduler,
  ) {}

  /**
   * POST /admin/reconciliation/run
   * Trigger a manual reconciliation
   */
  @Post('run')
  async runReconciliation(): Promise<ReconciliationReport> {
    return this.reconciliationService.runReconciliation({
      reportType: ReportType.MANUAL,
    } as any);
  }

  /**
   * GET /admin/reconciliation/reports
   * Get paginated report history
   */
  /* Commented out - methods not implemented in service
  @Get('reports')
  async getReports(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedReports> {
    return this.reconciliationService.getReports(page, limit);
  }

  /**
   * GET /admin/reconciliation/reports/:id
   * Get specific report details
   */
  /* @Get('reports/:id')
  async getReportById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReconciliationReport> {
    const report = await this.reconciliationService.getReportById(id);

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  /**
   * GET /admin/reconciliation/summary
   * Get latest report summary for dashboard
   */
  /* @Get('summary')
  async getSummary(): Promise<ReportSummary> {
    return this.reconciliationService.getLatestReportSummary();
  }
  */

  /**
   * GET /admin/reconciliation/status
   * Get scheduler status
   */
  @Get('status')
  getSchedulerStatus(): {
    enabled: boolean;
    isRunning: boolean;
    isQuickCheckRunning: boolean;
  } {
    return this.reconciliationScheduler.getStatus();
  }

  /**
   * GET /admin/reconciliation/check/negative-balances
   * Run negative balance check only
   */
  /* Commented out - methods not implemented in service
  @Get('check/negative-balances')
  async checkNegativeBalances(): Promise<{
    count: number;
    inconsistencies: Inconsistency[];
  }> {
    const inconsistencies =
      await this.reconciliationService.detectNegativeBalances();

    return {
      count: inconsistencies.length,
      inconsistencies,
    };
  }

  /**
   * GET /admin/reconciliation/check/orphaned-bets
   * Run orphaned bets check only
   */
  /* @Get('check/orphaned-bets')
  async checkOrphanedBets(): Promise<{
    count: number;
    inconsistencies: Inconsistency[];
  }> {
    const inconsistencies =
      await this.reconciliationService.detectOrphanedBets();

    return {
      count: inconsistencies.length,
      inconsistencies,
    };
  }

  /**
   * GET /admin/reconciliation/check/mismatched-settlements
   * Run mismatched settlements check only
   */
  /* @Get('check/mismatched-settlements')
  async checkMismatchedSettlements(): Promise<{
    count: number;
    inconsistencies: Inconsistency[];
  }> {
    const inconsistencies =
      await this.reconciliationService.detectMismatchedSettlements();

    return {
      count: inconsistencies.length,
      inconsistencies,
    };
  }

  /**
   * GET /admin/reconciliation/check/stuck-settlements
   * Run stuck settlements check only
   */
  /* @Get('check/stuck-settlements')
  async checkStuckSettlements(): Promise<{
    count: number;
    inconsistencies: Inconsistency[];
  }> {
    const inconsistencies =
      await this.reconciliationService.detectStuckPendingSettlements();

    return {
      count: inconsistencies.length,
      inconsistencies,
    };
  }
  */
}
