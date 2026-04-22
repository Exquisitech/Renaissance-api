import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SolvencyService } from './solvency.service';

@Injectable()
export class SolvencyScheduler {
  private readonly logger = new Logger(SolvencyScheduler.name);
  private readonly COVERAGE_THRESHOLD = 1.1; // Example: 110% coverage required

  constructor(private readonly solvencyService: SolvencyService) {}

  // This should be replaced with actual treasury and spin pool fetch logic
  private async fetchTreasuryBalance(): Promise<number> {
    // TODO: Integrate with treasury service or contract
    return 1000000;
  }

  private async fetchSpinPoolLiabilities(): Promise<number> {
    // TODO: Integrate with spin pool service or contract
    return 50000;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySolvencyCheck() {
    this.logger.log('Running daily solvency metrics calculation...');
    const treasuryBalance = await this.fetchTreasuryBalance();
    const spinPoolLiabilities = await this.fetchSpinPoolLiabilities();
    const metrics = await this.solvencyService.computeAndStoreMetrics(
      treasuryBalance,
      spinPoolLiabilities,
    );
    if (metrics.coverageRatio < this.COVERAGE_THRESHOLD) {
      this.logger.error(
        `ALERT: Treasury coverage ratio below threshold! Ratio: ${metrics.coverageRatio}`,
      );
      // TODO: Integrate with alerting/notification system
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyProofGeneration() {
    this.logger.log('Generating daily proof of reserves...');
    try {
      const proof = await this.solvencyService.generateProofOfReserves(true);
      this.logger.log(
        `Daily proof generated: ${proof.id} with root ${proof.merkleRoot}`,
      );
    } catch (error) {
      this.logger.error(`Failed to generate daily proof: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_WEEK_ON_SUNDAY_AT_3AM)
  async handleWeeklyArchival() {
    this.logger.log('Archiving old solvency proofs...');
    try {
      const archived = await this.solvencyService.archiveOldProofs(90);
      this.logger.log(`Archived ${archived} old proofs`);
    } catch (error) {
      this.logger.error(`Failed to archive proofs: ${error.message}`);
    }
  }
}
