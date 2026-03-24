import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StakingService, RewardProcessingResult } from './staking.service';

/**
 * RewardProcessor
 *
 * A scheduled cron job that periodically scans for matured staking positions
 * and automatically distributes principal + rewards to users' wallets.
 *
 * Schedule: every hour at minute 0  (CronExpression.EVERY_HOUR)
 * Override: set STAKING_REWARD_CRON env var to any valid cron string.
 *
 * All business logic lives in StakingService.processMaturedStakes() — this
 * class is intentionally thin so the logic is fully unit-testable without
 * a scheduler context.
 */
@Injectable()
export class RewardProcessor {
  private readonly logger = new Logger(RewardProcessor.name);

  /** Guards against a slow run overlapping with the next scheduled tick */
  private isRunning = false;

  constructor(private readonly stakingService: StakingService) {}

  // ─── Scheduled Job ────────────────────────────────────────────────────────

  /**
   * Runs every hour.
   * Adjust the cron expression here (or via env) to change frequency.
   *
   * Typical production cadences:
   *   EVERY_HOUR          → low volume, small user base
   *   EVERY_30_MINUTES    → medium volume
   *   '0 0 * * *'         → once per day (very low volume)
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'staking-reward-processor' })
  async handleStakingRewards(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'RewardProcessor: previous run still in progress — skipping this tick',
      );
      return;
    }

    this.isRunning = true;
    this.logger.log('RewardProcessor: starting scheduled reward distribution');

    try {
      const result = await this.stakingService.processMaturedStakes();
      this.logResult(result);
    } catch (error) {
      // Top-level catch: an unexpected error outside per-stake handling
      this.logger.error(
        'RewardProcessor: unexpected top-level error',
        (error as Error).stack,
      );
    } finally {
      this.isRunning = false;
    }
  }

  // ─── Manual Trigger (admin / testing) ─────────────────────────────────────

  /**
   * Allows an admin controller or test suite to trigger processing on-demand
   * without waiting for the cron schedule.
   *
   * Example usage in a controller:
   *   @Post('admin/staking/process-rewards')
   *   triggerRewards() { return this.rewardProcessor.triggerManually(); }
   */
  async triggerManually(): Promise<RewardProcessingResult> {
    this.logger.log('RewardProcessor: manual trigger requested');
    return this.stakingService.processMaturedStakes();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private logResult(result: RewardProcessingResult): void {
    const summary =
      `processed=${result.processed} failed=${result.failed} skipped=${result.skipped}`;

    if (result.failed > 0) {
      this.logger.warn(`RewardProcessor: completed with failures — ${summary}`);
      result.errors.forEach(({ stakeId, reason }) =>
        this.logger.warn(`  ↳ stake ${stakeId}: ${reason}`),
      );
    } else {
      this.logger.log(`RewardProcessor: completed successfully — ${summary}`);
    }
  }
}