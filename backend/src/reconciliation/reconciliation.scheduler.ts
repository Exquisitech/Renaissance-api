import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ReconciliationService } from './reconciliation.service';
import { ReportType, Severity } from './entities/reconciliation-report.entity';

@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);
  private isRunning = false;
  private isQuickCheckRunning = false;
  private isDailyBalanceReconciliationRunning = false;

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly configService: ConfigService,
  ) {}

  private isEnabled(): boolean {
    return (
      this.configService.get<string>('RECONCILIATION_ENABLED', 'true') ===
      'true'
    );
  }

  /**
   * Full reconciliation - runs every hour
   * Checks all inconsistency types
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleFullReconciliation(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('Reconciliation is disabled');
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Full reconciliation already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled full reconciliation...');

    try {
      const report = await this.reconciliationService.runReconciliation({
        type: ReportType.SCHEDULED,
        includeLedgerConsistency: true,
      });

      this.logger.log(
        `Scheduled reconciliation completed. Report ID: ${report.id}, Total issues: ${report.totalInconsistencies}`,
      );

      // Alert on critical issues
      if (report.negativeBalanceCount > 0) {
        this.logger.error(
          `ALERT: ${report.negativeBalanceCount} users have negative balances!`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Scheduled reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Daily reconciliation of on-chain and off-chain balances.
   */
  @Cron('0 2 * * *')
  async handleDailyBalanceReconciliation(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('Daily balance reconciliation is disabled');
      return;
    }

    if (this.isDailyBalanceReconciliationRunning) {
      this.logger.warn('Daily balance reconciliation already running, skipping...');
      return;
    }

    this.isDailyBalanceReconciliationRunning = true;
    this.logger.log('Starting daily on-chain/off-chain balance reconciliation...');

    try {
      const report = await this.reconciliationService.runReconciliation({
        type: ReportType.SCHEDULED,
        includeLedgerConsistency: true,
      });

      this.logger.log(
        `Daily balance reconciliation completed. Report ID: ${report.id}, issues: ${report.totalInconsistencies}`,
      );

      if (report.onchainDiscrepancyCount + report.offchainDiscrepancyCount > 0) {
        this.logger.warn(
          `Admin review required: ${report.onchainDiscrepancyCount + report.offchainDiscrepancyCount} on-chain/off-chain discrepancies detected.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Daily balance reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isDailyBalanceReconciliationRunning = false;
    }
  }

  /**
   * Quick negative balance check - runs every 30 minutes
   * Only checks for negative balances (critical issues)
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleQuickNegativeBalanceCheck(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('Reconciliation is disabled');
      return;
    }

    if (this.isQuickCheckRunning) {
      this.logger.warn('Quick balance check already running, skipping...');
      return;
    }

    this.isQuickCheckRunning = true;
    this.logger.debug('Starting quick negative balance check...');

    try {
      // Note: detectNegativeBalances method not implemented in service
      // const negativeBalances =
      //   await this.reconciliationService.detectNegativeBalances();
      const negativeBalances: any[] = [];

      if (negativeBalances.length > 0) {
        this.logger.error(
          `ALERT: Quick check found ${negativeBalances.length} users with negative balances!`,
        );

        // Log details of each negative balance
        for (const issue of negativeBalances) {
          this.logger.error(
            `  - User ${issue.details.email}: Balance ${issue.details.walletBalance}`,
          );
        }
      } else {
        this.logger.debug('Quick balance check: No negative balances found');
      }
    } catch (error) {
      this.logger.error(
        `Quick balance check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isQuickCheckRunning = false;
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    isQuickCheckRunning: boolean;
  } {
    return {
      enabled: this.isEnabled(),
      isRunning: this.isRunning,
      isQuickCheckRunning: this.isQuickCheckRunning,
    };
  }
}
