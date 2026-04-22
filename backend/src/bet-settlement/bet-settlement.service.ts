import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Bet,
  BetStatus,
} from '../bets/entities/bet.entity';
import { BetsService } from '../bets/bets.service';
import {
  BetSettlementAuditAction,
  BetSettlementAuditLog,
} from './entities/bet-settlement-audit-log.entity';
import {
  BetSettlementJob,
  BetSettlementJobStatus,
} from './entities/bet-settlement-job.entity';
import {
  IsNull,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

@Injectable()
export class BetSettlementService {
  private readonly logger = new Logger(BetSettlementService.name);
  private readonly batchSize = 200;
  private isProcessingQueue = false;

  constructor(
    @InjectRepository(BetSettlementJob)
    private readonly jobRepository: Repository<BetSettlementJob>,
    @InjectRepository(BetSettlementAuditLog)
    private readonly auditRepository: Repository<BetSettlementAuditLog>,
    @InjectRepository(Bet)
    private readonly betRepository: Repository<Bet>,
    private readonly betsService: BetsService,
  ) {}

  async enqueueMatchSettlement(
    matchId: string,
    requestedBy?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<BetSettlementJob | null> {
    const pendingBetCount = await this.betRepository.count({
      where: { matchId, status: BetStatus.PENDING },
    });

    if (pendingBetCount === 0) {
      await this.writeAudit(
        null,
        matchId,
        BetSettlementAuditAction.SKIPPED,
        'Settlement queue skipped because there are no pending bets',
        null,
        null,
        { pendingBetCount: 0, ...(metadata || {}) },
      );
      return null;
    }

    const activeJob = await this.jobRepository.findOne({
      where: [
        { matchId, status: BetSettlementJobStatus.PENDING },
        { matchId, status: BetSettlementJobStatus.PROCESSING },
      ],
      order: { createdAt: 'DESC' },
    });

    if (activeJob) {
      await this.writeAudit(
        activeJob.id,
        matchId,
        BetSettlementAuditAction.SKIPPED,
        'Settlement queue request ignored because an active job already exists',
        activeJob.attemptCount,
        null,
        { pendingBetCount, ...(metadata || {}) },
      );
      return activeJob;
    }

    const job = this.jobRepository.create({
      matchId,
      status: BetSettlementJobStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 5,
      nextRetryAt: new Date(),
      requestedBy: requestedBy ?? null,
      metadata: {
        pendingBetCount,
        ...(metadata || {}),
      },
    });

    const savedJob = await this.jobRepository.save(job);
    await this.writeAudit(
      savedJob.id,
      matchId,
      BetSettlementAuditAction.ENQUEUED,
      'Settlement job enqueued',
      savedJob.attemptCount,
      null,
      {
        pendingBetCount,
        requestedBy: requestedBy ?? null,
        ...(metadata || {}),
      },
    );

    return savedJob;
  }

  async getJob(jobId: string): Promise<BetSettlementJob> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Settlement job ${jobId} not found`);
    }

    return job;
  }

  async getJobs(matchId?: string): Promise<BetSettlementJob[]> {
    const where = matchId ? { matchId } : {};
    return this.jobRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getAuditLogs(matchId?: string): Promise<BetSettlementAuditLog[]> {
    const where = matchId ? { matchId } : {};
    return this.auditRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async retryFailedJob(jobId: string): Promise<BetSettlementJob> {
    const job = await this.getJob(jobId);
    job.status = BetSettlementJobStatus.PENDING;
    job.nextRetryAt = new Date();
    job.lastError = null;
    job.completedAt = null;
    await this.jobRepository.save(job);

    await this.writeAudit(
      job.id,
      job.matchId,
      BetSettlementAuditAction.ENQUEUED,
      'Settlement job manually requeued',
      job.attemptCount,
      null,
      { requestedBy: job.requestedBy },
    );

    return job;
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingJobs(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    try {
      const now = new Date();
      const dueJobs = await this.jobRepository.find({
        where: [
          {
            status: BetSettlementJobStatus.PENDING,
            nextRetryAt: IsNull(),
          },
          {
            status: BetSettlementJobStatus.PENDING,
            nextRetryAt: LessThanOrEqual(now),
          },
        ],
        order: { createdAt: 'ASC' },
        take: 5,
      });

      for (const job of dueJobs) {
        await this.processJob(job);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async processJob(job: BetSettlementJob): Promise<void> {
    job.status = BetSettlementJobStatus.PROCESSING;
    job.startedAt = new Date();
    job.lastError = null;
    await this.jobRepository.save(job);

    await this.writeAudit(
      job.id,
      job.matchId,
      BetSettlementAuditAction.PROCESSING_STARTED,
      'Settlement job processing started',
      job.attemptCount + 1,
      null,
      {
        batchSize: this.batchSize,
      },
    );

    try {
      const summary = await this.betsService.settleMatchBets(job.matchId, {
        batchSize: this.batchSize,
      });

      job.attemptCount += 1;
      job.status = BetSettlementJobStatus.COMPLETED;
      job.completedAt = new Date();
      job.nextRetryAt = null;
      job.lastSummary = { ...summary };
      await this.jobRepository.save(job);

      await this.writeAudit(
        job.id,
        job.matchId,
        BetSettlementAuditAction.COMPLETED,
        'Settlement job completed successfully',
        job.attemptCount,
        null,
        { ...summary },
      );
    } catch (error) {
      const errorMessage = this.formatError(error);
      job.attemptCount += 1;
      job.lastError = errorMessage;

      if (job.attemptCount >= job.maxAttempts) {
        job.status = BetSettlementJobStatus.FAILED;
        job.nextRetryAt = null;
        job.completedAt = new Date();
        await this.jobRepository.save(job);

        await this.writeAudit(
          job.id,
          job.matchId,
          BetSettlementAuditAction.FAILED,
          'Settlement job failed permanently',
          job.attemptCount,
          errorMessage,
          null,
        );
      } else {
        const retryDelayMs = Math.min(
          60_000 * Math.pow(2, job.attemptCount - 1),
          15 * 60_000,
        );
        job.status = BetSettlementJobStatus.PENDING;
        job.nextRetryAt = new Date(Date.now() + retryDelayMs);
        await this.jobRepository.save(job);

        await this.writeAudit(
          job.id,
          job.matchId,
          BetSettlementAuditAction.RETRY_SCHEDULED,
          'Settlement job scheduled for retry',
          job.attemptCount,
          errorMessage,
          {
            retryAt: job.nextRetryAt.toISOString(),
            retryDelayMs,
          },
        );
      }

      this.logger.error(
        `Settlement job ${job.id} failed for match ${job.matchId}: ${errorMessage}`,
      );
    }
  }

  private async writeAudit(
    jobId: string | null,
    matchId: string,
    action: BetSettlementAuditAction,
    message: string,
    attempt: number | null,
    errorMessage?: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    const auditLog = this.auditRepository.create({
      jobId,
      matchId,
      action,
      message,
      attempt,
      errorMessage: errorMessage ?? null,
      metadata: metadata ?? null,
    });
    await this.auditRepository.save(auditLog);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'unknown error';
    }
  }
}
