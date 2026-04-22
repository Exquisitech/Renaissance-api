import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { Bet, BetStatus } from '../../bets/entities/bet.entity';
import {
  ContractEventLog,
  ContractEventStatus,
  ContractEventType,
} from './entities/contract-event-log.entity';
import { ContractEventCheckpoint } from './entities/contract-event-checkpoint.entity';
import { NFTReward, NFTTier } from '../../spin-game/entities/nft-reward.entity';
import { Spin, SpinOutcome, SpinStatus } from '../../spin/entities/spin.entity';
import {
  SpinSession,
  SpinSessionStatus,
} from '../../spin/entities/spin-session.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import { BetSettledEvent } from '../../leaderboard/domain/events/bet-settled.event';
import { SpinSettledEvent } from '../../leaderboard/domain/events/spin-settled.event';
import { StakeCreditedEvent } from '../../leaderboard/domain/events/stake-credited.event';
import { StakeDebitedEvent } from '../../leaderboard/domain/events/stake-debited.event';

type EventProcessOutcome = 'processed' | 'skipped';

interface NormalizedContractEvent {
  id: string;
  cursor: string;
  ledger: number;
  txHash: string;
  contractId: string | null;
  topics: string[];
  payload: Record<string, unknown>;
  ledgerClosedAt: Date | null;
}

interface EventHandlingResult {
  outcome: EventProcessOutcome;
  reason?: string;
  postCommitEvents: object[];
}

@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventListenerService.name);
  private readonly checkpointId = 'soroban_contract_listener';

  private server: rpc.Server | null = null;
  private contractId = '';
  private cursor: string | null = null;
  private lastLedger = 0;
  private shutdownRequested = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private reconnectAttempts = 0;

  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly pageLimit: number;
  private readonly processingRetryAttempts: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly configuredStartLedger: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    @InjectRepository(ContractEventLog)
    private readonly eventLogRepository: Repository<ContractEventLog>,
    @InjectRepository(ContractEventCheckpoint)
    private readonly checkpointRepository: Repository<ContractEventCheckpoint>,
  ) {
    this.enabled = this.configService.get<boolean>(
      'blockchain.events.enabled',
      true,
    );
    this.pollIntervalMs = this.configService.get<number>(
      'blockchain.events.pollIntervalMs',
      5000,
    );
    this.pageLimit = this.configService.get<number>(
      'blockchain.events.pageLimit',
      100,
    );
    this.processingRetryAttempts = this.configService.get<number>(
      'blockchain.events.processingRetryAttempts',
      3,
    );
    this.reconnectBaseDelayMs = this.configService.get<number>(
      'blockchain.events.reconnectBaseDelayMs',
      1000,
    );
    this.reconnectMaxDelayMs = this.configService.get<number>(
      'blockchain.events.reconnectMaxDelayMs',
      30000,
    );
    this.configuredStartLedger = this.configService.get<number>(
      'blockchain.events.startLedger',
      0,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Soroban event listener disabled by configuration');
      return;
    }

    const rpcUrl = this.configService.get<string>('blockchain.stellar.rpcUrl');
    this.contractId =
      this.configService.get<string>('blockchain.soroban.contractId') || '';

    if (!rpcUrl || !this.contractId) {
      this.logger.warn(
        'Event listener disabled because STELLAR_RPC_URL or SOROBAN_CONTRACT_ID is missing',
      );
      return;
    }

    this.server = new rpc.Server(rpcUrl);

    await this.ensureCheckpoint();
    await this.bootstrapCheckpoint();

    this.logger.log(
      `Event listener started (contract=${this.contractId}, pollIntervalMs=${this.pollIntervalMs}, pageLimit=${this.pageLimit})`,
    );

    this.scheduleNextPoll(0);
  }

  async onModuleDestroy(): Promise<void> {
    this.shutdownRequested = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getMonitoringSnapshot(): Record<string, unknown> {
    return {
      enabled: this.enabled,
      contractId: this.contractId,
      cursor: this.cursor,
      lastLedger: this.lastLedger,
      reconnectAttempts: this.reconnectAttempts,
      polling: this.isPolling,
    };
  }

  async getCheckpointState(): Promise<ContractEventCheckpoint> {
    return this.ensureCheckpoint();
  }

  async getEventLogs(params: {
    page?: number;
    limit?: number;
    status?: ContractEventStatus;
    fromLedger?: number;
    toLedger?: number;
  }): Promise<{ data: ContractEventLog[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
    const query = this.eventLogRepository.createQueryBuilder('event_log');

    if (params.status) {
      query.andWhere('event_log.status = :status', { status: params.status });
    }
    if (params.fromLedger !== undefined) {
      query.andWhere('event_log.ledger >= :fromLedger', {
        fromLedger: params.fromLedger,
      });
    }
    if (params.toLedger !== undefined) {
      query.andWhere('event_log.ledger <= :toLedger', {
        toLedger: params.toLedger,
      });
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('event_log.ledger', 'DESC')
      .addOrderBy('event_log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  async queryEventsFromLedger(
    startLedger: number,
    endLedger?: number,
    limit?: number,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchNormalizedEventsRange(
      startLedger,
      endLedger,
      limit,
    );

    return {
      startLedger,
      endLedger: endLedger ?? null,
      latestLedger: response.latestLedger,
      oldestLedger: response.oldestLedger,
      cursor: response.cursor,
      events: response.events.map((event) => ({ ...event })),
    };
  }

  async detectLedgerGaps(
    startLedger: number,
    endLedger?: number,
    limit?: number,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchNormalizedEventsRange(
      startLedger,
      endLedger,
      limit,
    );
    const eventIds = response.events.map((event) => event.id);
    const existingLogs = eventIds.length
      ? await this.eventLogRepository.find({
          where: { eventId: In(eventIds) },
        })
      : [];
    const loggedEventIds = new Set(existingLogs.map((log) => log.eventId));
    const failedEventIds = new Set(
      existingLogs
        .filter((log) => log.status === ContractEventStatus.FAILED)
        .map((log) => log.eventId),
    );

    const missingEvents = response.events.filter(
      (event) => !loggedEventIds.has(event.id),
    );
    const missingLedgers = Array.from(
      new Set([
        ...missingEvents.map((event) => event.ledger),
        ...existingLogs
          .filter((log) => log.status === ContractEventStatus.FAILED)
          .map((log) => log.ledger),
      ]),
    ).sort((left, right) => left - right);

    return {
      startLedger,
      endLedger: endLedger ?? null,
      latestLedger: response.latestLedger,
      oldestLedger: response.oldestLedger,
      missingLedgers,
      missingEventIds: missingEvents.map((event) => event.id),
      failedEventIds: Array.from(failedEventIds),
      examinedEvents: response.events.length,
    };
  }

  async replayEventsFromLedger(params: {
    startLedger: number;
    endLedger?: number;
    limit?: number;
    updateCheckpoint?: boolean;
  }): Promise<Record<string, unknown>> {
    const response = await this.fetchNormalizedEventsRange(
      params.startLedger,
      params.endLedger,
      params.limit,
    );

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ eventId: string; error: string }> = [];

    for (const event of response.events) {
      try {
        const outcome = await this.processEventWithRetry(event);
        if (outcome === 'processed') {
          processed += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        failures.push({
          eventId: event.id,
          error: this.formatError(error),
        });
      }
    }

    if (params.updateCheckpoint && response.events.length > 0) {
      const replayLastLedger = response.events[response.events.length - 1].ledger;
      this.cursor = null;
      this.lastLedger = Math.max(this.lastLedger, replayLastLedger);
      await this.updateCheckpoint({
        cursor: null,
        lastLedger: this.lastLedger,
        lastPolledAt: new Date(),
        lastError:
          failed > 0
            ? `Replay completed with ${failed} failure(s)`
            : null,
      });
    }

    return {
      startLedger: params.startLedger,
      endLedger: params.endLedger ?? null,
      processed,
      skipped,
      failed,
      failures,
      replayedEvents: response.events.length,
      latestLedger: response.latestLedger,
      oldestLedger: response.oldestLedger,
    };
  }

  async resetCheckpoint(params: {
    startLedger?: number;
    toLatest?: boolean;
  }): Promise<ContractEventCheckpoint> {
    if (params.toLatest) {
      await this.resetCheckpointToLatestLedger();
      return this.ensureCheckpoint();
    }

    const targetLedger = Math.max(
      1,
      params.startLedger ?? this.configuredStartLedger ?? 1,
    );
    this.cursor = null;
    this.lastLedger = targetLedger;
    await this.updateCheckpoint({
      cursor: null,
      lastLedger: targetLedger,
      lastPolledAt: new Date(),
      lastError: null,
    });

    return this.ensureCheckpoint();
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.shutdownRequested) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      void this.pollOnceSafely();
    }, delayMs);
  }

  private async pollOnceSafely(): Promise<void> {
    if (this.shutdownRequested || this.isPolling) {
      return;
    }

    this.isPolling = true;
    try {
      await this.pollOnce();
      this.reconnectAttempts = 0;
      this.scheduleNextPoll(this.pollIntervalMs);
    } catch (error) {
      await this.handlePollError(error);
    } finally {
      this.isPolling = false;
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.server || !this.contractId) {
      return;
    }

    const request = await this.buildGetEventsRequest();
    const response = await this.server.getEvents(request);

    const normalizedEvents = response.events.map((event) =>
      this.normalizeEvent(event, response.cursor),
    );

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const event of normalizedEvents) {
      try {
        const outcome = await this.processEventWithRetry(event);
        if (outcome === 'processed') {
          processedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        await this.incrementCheckpointFailures(error);
        throw error;
      }
    }

    this.cursor = response.cursor;
    const maxLedger = normalizedEvents.reduce(
      (currentMax, item) => Math.max(currentMax, item.ledger),
      this.lastLedger,
    );
    this.lastLedger = maxLedger;

    await this.updateCheckpoint({
      cursor: this.cursor,
      lastLedger: this.lastLedger,
      lastPolledAt: new Date(),
      lastEventAt:
        normalizedEvents.length > 0
          ? normalizedEvents[normalizedEvents.length - 1].ledgerClosedAt
          : null,
      lastError: null,
      processedDelta: processedCount,
      skippedDelta: skippedCount,
      failedDelta: failedCount,
    });

    if (normalizedEvents.length > 0) {
      this.logger.log(
        `Processed ${normalizedEvents.length} Soroban event(s): processed=${processedCount}, skipped=${skippedCount}, failed=${failedCount}, cursor=${this.cursor}`,
      );
    }
  }

  private async handlePollError(error: unknown): Promise<void> {
    const message = this.formatError(error);
    this.logger.error(`Event polling failed: ${message}`);

    if (this.isRetentionWindowError(message)) {
      await this.resetCheckpointToLatestLedger();
    }

    this.reconnectAttempts += 1;
    await this.updateCheckpoint({
      reconnectCountDelta: 1,
      lastError: message,
      lastPolledAt: new Date(),
    });

    const backoffDelay = Math.min(
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.reconnectMaxDelayMs,
    );

    this.logger.warn(
      `Reconnecting event listener in ${backoffDelay}ms (attempt=${this.reconnectAttempts})`,
    );
    this.scheduleNextPoll(backoffDelay);
  }

  private async processEventWithRetry(
    event: NormalizedContractEvent,
  ): Promise<EventProcessOutcome> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= this.processingRetryAttempts; attempt++) {
      try {
        return await this.processSingleEvent(event);
      } catch (error) {
        lastError = error;
        const message = this.formatError(error);
        this.logger.warn(
          `Failed processing event ${event.id} (attempt=${attempt}/${this.processingRetryAttempts}): ${message}`,
        );

        if (attempt < this.processingRetryAttempts) {
          await this.sleep(Math.min(300 * Math.pow(2, attempt - 1), 2000));
        }
      }
    }

    await this.markEventFailed(event, this.formatError(lastError));
    throw lastError instanceof Error
      ? lastError
      : new Error('Event processing failed');
  }

  private async processSingleEvent(
    event: NormalizedContractEvent,
  ): Promise<EventProcessOutcome> {
    const result = await this.eventLogRepository.manager.transaction(
      async (manager) => {
        const existingLog = await manager.findOne(ContractEventLog, {
          where: { eventId: event.id },
        });

        if (
          existingLog &&
          (existingLog.status === ContractEventStatus.PROCESSED ||
            existingLog.status === ContractEventStatus.SKIPPED)
        ) {
          return {
            outcome: 'skipped' as const,
            postCommitEvents: [] as object[],
          };
        }

        const eventType = this.classifyEventType(event.topics, event.payload);
        const log = existingLog ?? new ContractEventLog();
        log.eventId = event.id;
        log.eventType = eventType;
        log.ledger = event.ledger;
        log.txHash = event.txHash || null;
        log.cursor = event.cursor;
        log.topics = event.topics;
        log.payload = event.payload;
        log.status = ContractEventStatus.PENDING;
        log.attempts = (log.attempts || 0) + 1;
        log.processedAt = null;
        log.errorMessage = null;
        await manager.save(log);

        const handlingResult = await this.handleEventByType(
          manager,
          eventType,
          event,
        );

        log.status =
          handlingResult.outcome === 'processed'
            ? ContractEventStatus.PROCESSED
            : ContractEventStatus.SKIPPED;
        log.errorMessage = handlingResult.reason || null;
        log.processedAt = new Date();
        await manager.save(log);

        return handlingResult;
      },
    );

    for (const domainEvent of result.postCommitEvents) {
      try {
        this.eventBus.publish(domainEvent);
      } catch (error) {
        this.logger.warn(
          `Failed to publish post-commit domain event for ${event.id}: ${this.formatError(error)}`,
        );
      }
    }

    return result.outcome;
  }

  private async handleEventByType(
    manager: EntityManager,
    eventType: ContractEventType,
    event: NormalizedContractEvent,
  ): Promise<EventHandlingResult> {
    switch (eventType) {
      case ContractEventType.STAKING:
        return this.handleStakingEvent(manager, event);
      case ContractEventType.SPIN_REWARD:
        return this.handleSpinRewardEvent(manager, event);
      case ContractEventType.NFT_MINT:
        return this.handleNftMintEvent(manager, event);
      case ContractEventType.BET_SETTLEMENT:
        return this.handleBetSettlementEvent(manager, event);
      default:
        return {
          outcome: 'skipped',
          reason: 'Unknown or unsupported event type',
          postCommitEvents: [],
        };
    }
  }

  private async handleStakingEvent(
    manager: EntityManager,
    event: NormalizedContractEvent,
  ): Promise<EventHandlingResult> {
    const userId = this.readString(event.payload, [
      'userId',
      'user_id',
      'staker',
      'account',
      'address',
      'wallet',
    ]);
    if (!userId) {
      return {
        outcome: 'skipped',
        reason: 'staking event missing user identifier',
        postCommitEvents: [],
      };
    }

    const amount = this.readNumber(event.payload, [
      'amount',
      'stakeAmount',
      'stake_amount',
      'rewardAmount',
      'reward_amount',
      'value',
      'delta',
    ]);
    if (amount === null) {
      return {
        outcome: 'skipped',
        reason: 'staking event missing amount',
        postCommitEvents: [],
      };
    }

    const action =
      this.readString(event.payload, [
        'action',
        'event',
        'type',
        'operation',
      ]) || this.deriveActionFromTopics(event.topics);

    const explicitDelta = this.readNumber(event.payload, [
      'balanceDelta',
      'balance_delta',
      'delta',
    ]);
    const delta =
      explicitDelta ?? this.deriveSignedDelta(amount, action, event.topics);
    const rewardAmount =
      this.readNumber(event.payload, ['rewardAmount', 'reward_amount']) ??
      (delta > 0 ? Math.abs(delta) : 0);
    const stakedAmount =
      this.readNumber(event.payload, ['stakeAmount', 'stake_amount']) ??
      Math.abs(amount);

    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) {
      return {
        outcome: 'skipped',
        reason: `staking event user not found (${userId})`,
        postCommitEvents: [],
      };
    }

    user.walletBalance = Number(user.walletBalance) + delta;
    await manager.save(user);

    const referenceId = this.toReferenceId(event.id);
    const existingTx = await manager.findOne(Transaction, {
      where: { referenceId },
    });
    if (!existingTx) {
      const transaction = manager.create(Transaction, {
        userId: user.id,
        type:
          delta >= 0
            ? TransactionType.STAKING_REWARD
            : TransactionType.STAKING_PENALTY,
        amount: delta,
        status: TransactionStatus.COMPLETED,
        referenceId,
        metadata: {
          source: 'soroban_event_listener',
          category: ContractEventType.STAKING,
          action,
          eventId: event.id,
          txHash: event.txHash,
          ledger: event.ledger,
        },
      });
      await manager.save(transaction);
    }

    const postCommitEvents: object[] = [];
    if (delta >= 0) {
      postCommitEvents.push(
        new StakeCreditedEvent(user.id, stakedAmount, rewardAmount),
      );
    } else {
      postCommitEvents.push(
        new StakeDebitedEvent(
          user.id,
          Math.abs(delta),
          action || 'stake_debit',
        ),
      );
    }

    return { outcome: 'processed', postCommitEvents };
  }

  private async handleSpinRewardEvent(
    manager: EntityManager,
    event: NormalizedContractEvent,
  ): Promise<EventHandlingResult> {
    const spinId = this.readString(event.payload, [
      'spinId',
      'spin_id',
      'sessionId',
      'session_id',
    ]);
    const payoutAmount = this.readNumber(event.payload, [
      'payoutAmount',
      'payout_amount',
      'rewardAmount',
      'reward_amount',
      'amount',
      'winAmount',
    ]);
    const outcome = this.readString(event.payload, ['outcome', 'result']);
    const status = this.parseSpinStatus(
      this.readString(event.payload, ['status', 'state']),
      payoutAmount,
      event.topics,
    );
    const txReference =
      this.readString(event.payload, [
        'txHash',
        'tx_hash',
        'transactionHash',
        'transaction_hash',
      ]) || event.txHash;

    const spin = await this.findSpinForEvent(manager, spinId);
    if (!spin) {
      return {
        outcome: 'skipped',
        reason: `spin event could not find spin record (spinId=${spinId || 'n/a'})`,
        postCommitEvents: [],
      };
    }

    spin.status = status;
    if (payoutAmount !== null) {
      spin.payoutAmount = payoutAmount;
    }

    const mappedOutcome = this.parseSpinOutcome(outcome);
    if (mappedOutcome) {
      spin.outcome = mappedOutcome;
    }

    spin.metadata = {
      ...(spin.metadata || {}),
      onChain: {
        eventId: event.id,
        txHash: txReference,
        ledger: event.ledger,
        syncedAt: new Date().toISOString(),
      },
    } as Spin['metadata'];

    await manager.save(spin);

    if (spinId) {
      const spinSessionWhere: FindOptionsWhere<SpinSession>[] = [
        { id: spinId },
      ];
      if (txReference) {
        spinSessionWhere.push({ txReference });
      }

      const spinSession = await manager.findOne(SpinSession, {
        where: spinSessionWhere,
      });

      if (spinSession) {
        spinSession.txReference = txReference || null;
        spinSession.status =
          status === SpinStatus.COMPLETED
            ? SpinSessionStatus.COMPLETED
            : status === SpinStatus.FAILED
              ? SpinSessionStatus.FAILED
              : SpinSessionStatus.PENDING;
        await manager.save(spinSession);
      }
    }

    const postCommitEvents: object[] = [];
    if (status === SpinStatus.COMPLETED) {
      postCommitEvents.push(
        new SpinSettledEvent(
          spin.userId,
          spin.id,
          spin.outcome,
          Number(spin.stakeAmount),
          Number(spin.payoutAmount),
          Number(spin.payoutAmount) > Number(spin.stakeAmount),
          event.ledgerClosedAt || new Date(),
        ),
      );
    }

    return { outcome: 'processed', postCommitEvents };
  }

  private async handleNftMintEvent(
    manager: EntityManager,
    event: NormalizedContractEvent,
  ): Promise<EventHandlingResult> {
    const userId = this.readString(event.payload, [
      'userId',
      'user_id',
      'owner',
      'recipient',
    ]);
    const nftId = this.readString(event.payload, [
      'nftId',
      'nft_id',
      'tokenId',
      'token_id',
      'assetId',
      'asset_id',
    ]);

    if (!userId || !nftId) {
      return {
        outcome: 'skipped',
        reason: 'nft mint event missing userId or nftId',
        postCommitEvents: [],
      };
    }

    const nftContractAddress =
      this.readString(event.payload, [
        'nftContractAddress',
        'nft_contract_address',
        'contractAddress',
        'contract_address',
      ]) ||
      event.contractId ||
      this.contractId;
    const metadataUri = this.readString(event.payload, [
      'metadataUri',
      'metadata_uri',
      'tokenUri',
      'token_uri',
    ]);
    const tier = this.parseNftTier(
      this.readString(event.payload, ['tier', 'rarity']),
    );
    const spinGameId = this.readString(event.payload, [
      'spinGameId',
      'spin_game_id',
      'spinId',
      'spin_id',
    ]);

    let nftReward = await manager.findOne(NFTReward, {
      where: { nftContractAddress, nftId },
    });

    if (!nftReward) {
      nftReward = manager.create(NFTReward, {
        userId,
        nftContractAddress,
        nftId,
      });
    }

    nftReward.userId = userId;
    nftReward.tier = tier;
    nftReward.isMinted = true;
    nftReward.mintTransactionHash = event.txHash || null;
    nftReward.claimedAt = new Date();
    nftReward.metadataUri = metadataUri || nftReward.metadataUri || null;
    nftReward.spinGameId = spinGameId || nftReward.spinGameId || null;

    await manager.save(nftReward);

    return { outcome: 'processed', postCommitEvents: [] };
  }

  private async handleBetSettlementEvent(
    manager: EntityManager,
    event: NormalizedContractEvent,
  ): Promise<EventHandlingResult> {
    const betId = this.readString(event.payload, ['betId', 'bet_id', 'id']);
    if (!betId) {
      return {
        outcome: 'skipped',
        reason: 'bet settlement event missing bet id',
        postCommitEvents: [],
      };
    }

    const bet = await manager.findOne(Bet, {
      where: { id: betId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!bet) {
      return {
        outcome: 'skipped',
        reason: `bet not found (${betId})`,
        postCommitEvents: [],
      };
    }

    const parsedStatus = this.parseBetStatus(
      this.readString(event.payload, ['status', 'result', 'outcome']),
      this.readBoolean(event.payload, ['isWin', 'won', 'is_winner']),
      event.topics,
    );

    if (!parsedStatus) {
      return {
        outcome: 'skipped',
        reason: 'bet settlement status could not be determined',
        postCommitEvents: [],
      };
    }

    bet.status = parsedStatus;
    bet.settledAt = event.ledgerClosedAt || new Date();
    bet.metadata = {
      ...(bet.metadata || {}),
      onChainSettlement: {
        eventId: event.id,
        txHash: event.txHash,
        ledger: event.ledger,
        syncedAt: new Date().toISOString(),
      },
    };
    await manager.save(bet);

    const payoutAmount =
      this.readNumber(event.payload, [
        'payoutAmount',
        'payout_amount',
        'winningsAmount',
        'winnings_amount',
        'amount',
      ]) ?? (parsedStatus === BetStatus.WON ? Number(bet.potentialPayout) : 0);

    const referenceId = this.toReferenceId(event.id);
    const existingTx = await manager.findOne(Transaction, {
      where: { referenceId },
    });
    if (!existingTx) {
      if (parsedStatus === BetStatus.WON && payoutAmount > 0) {
        const tx = manager.create(Transaction, {
          userId: bet.userId,
          type: TransactionType.BET_WINNING,
          amount: payoutAmount,
          status: TransactionStatus.COMPLETED,
          relatedEntityId: bet.id,
          referenceId,
          metadata: {
            source: 'soroban_event_listener',
            category: ContractEventType.BET_SETTLEMENT,
            eventId: event.id,
            txHash: event.txHash,
            ledger: event.ledger,
          },
        });
        await manager.save(tx);
      }

      if (parsedStatus === BetStatus.CANCELLED) {
        const tx = manager.create(Transaction, {
          userId: bet.userId,
          type: TransactionType.BET_CANCELLATION,
          amount: Number(bet.stakeAmount),
          status: TransactionStatus.COMPLETED,
          relatedEntityId: bet.id,
          referenceId,
          metadata: {
            source: 'soroban_event_listener',
            category: ContractEventType.BET_SETTLEMENT,
            eventId: event.id,
            txHash: event.txHash,
            ledger: event.ledger,
          },
        });
        await manager.save(tx);
      }
    }

    const postCommitEvents: object[] = [];
    if (parsedStatus === BetStatus.WON || parsedStatus === BetStatus.LOST) {
      postCommitEvents.push(
        new BetSettledEvent(
          bet.userId,
          bet.id,
          bet.matchId,
          parsedStatus === BetStatus.WON,
          Number(bet.stakeAmount),
          parsedStatus === BetStatus.WON ? payoutAmount : 0,
          0,
          event.ledgerClosedAt || new Date(),
        ),
      );
    }

    return { outcome: 'processed', postCommitEvents };
  }

  private classifyEventType(
    topics: string[],
    payload: Record<string, unknown>,
  ): ContractEventType {
    const joinedTopics = topics.join(' ').toLowerCase();
    const eventHint = (
      this.readString(payload, ['event', 'type', 'name', 'action']) || ''
    ).toLowerCase();
    const combined = `${joinedTopics} ${eventHint}`;

    if (combined.includes('nft') || combined.includes('mint')) {
      return ContractEventType.NFT_MINT;
    }
    if (
      combined.includes('bet') &&
      (combined.includes('settle') ||
        combined.includes('won') ||
        combined.includes('lost') ||
        combined.includes('cancel'))
    ) {
      return ContractEventType.BET_SETTLEMENT;
    }
    if (
      combined.includes('spin') &&
      (combined.includes('reward') ||
        combined.includes('settle') ||
        combined.includes('payout') ||
        combined.includes('win'))
    ) {
      return ContractEventType.SPIN_REWARD;
    }
    if (combined.includes('stake')) {
      return ContractEventType.STAKING;
    }

    if (this.readString(payload, ['nftId', 'nft_id', 'tokenId', 'token_id'])) {
      return ContractEventType.NFT_MINT;
    }
    if (this.readString(payload, ['betId', 'bet_id'])) {
      return ContractEventType.BET_SETTLEMENT;
    }
    if (this.readString(payload, ['spinId', 'spin_id', 'sessionId'])) {
      return ContractEventType.SPIN_REWARD;
    }
    if (
      this.readString(payload, [
        'stakeAmount',
        'stake_amount',
        'staker',
        'rewardAmount',
      ])
    ) {
      return ContractEventType.STAKING;
    }

    return ContractEventType.UNKNOWN;
  }

  private normalizeEvent(
    event: rpc.Api.EventResponse,
    cursor: string,
  ): NormalizedContractEvent {
    const topics = (event.topic || []).map((topic) =>
      this.stringifyTopic(this.decodeScVal(topic)),
    );

    const rawPayload = this.decodeScVal(event.value);
    const payload = this.toPayloadRecord(rawPayload);

    return {
      id: event.id,
      cursor,
      ledger: event.ledger,
      txHash: event.txHash,
      contractId: event.contractId ? String(event.contractId) : null,
      topics,
      payload,
      ledgerClosedAt: event.ledgerClosedAt
        ? new Date(event.ledgerClosedAt)
        : null,
    };
  }

  private decodeScVal(value: xdr.ScVal): unknown {
    try {
      return this.normalizeUnknown(scValToNative(value));
    } catch {
      try {
        return value.toXDR('base64');
      } catch {
        return null;
      }
    }
  }

  private stringifyTopic(value: unknown): string {
    if (value === null || value === undefined) {
      return 'unknown';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.stringifyTopic(item)).join(':');
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[object]';
      }
    }
    return String(value);
  }

  private toPayloadRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    if (Array.isArray(value)) {
      return { items: value };
    }

    return { value };
  }

  private normalizeUnknown(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'bigint') {
      return input.toString();
    }

    if (input instanceof Date) {
      return input.toISOString();
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.normalizeUnknown(item));
    }

    if (input instanceof Map) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of input.entries()) {
        result[String(this.normalizeUnknown(key))] =
          this.normalizeUnknown(value);
      }
      return result;
    }

    if (typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        result[key] = this.normalizeUnknown(value);
      }
      return result;
    }

    return input;
  }

  private readValue(payload: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const value = payload[key];
        if (value !== undefined && value !== null) {
          return value;
        }
      }
    }
    return null;
  }

  private readString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | null {
    const value = this.readValue(payload, keys);
    if (value === null) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    return null;
  }

  private readNumber(
    payload: Record<string, unknown>,
    keys: string[],
  ): number | null {
    const value = this.readValue(payload, keys);
    if (value === null) {
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readBoolean(
    payload: Record<string, unknown>,
    keys: string[],
  ): boolean | null {
    const value = this.readValue(payload, keys);
    if (value === null) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'win', 'won'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'loss', 'lost'].includes(normalized)) {
        return false;
      }
    }
    return null;
  }

  private deriveActionFromTopics(topics: string[]): string {
    const normalized = topics.join(' ').toLowerCase();
    if (normalized.includes('unstake')) return 'unstake';
    if (normalized.includes('reward')) return 'reward';
    if (normalized.includes('credit')) return 'credit';
    if (normalized.includes('debit')) return 'debit';
    if (normalized.includes('stake')) return 'stake';
    return 'unknown';
  }

  private deriveSignedDelta(
    amount: number,
    action: string | null,
    topics: string[],
  ): number {
    const normalized = `${action || ''} ${topics.join(' ')}`.toLowerCase();
    const value = Math.abs(amount);

    if (
      normalized.includes('credit') ||
      normalized.includes('reward') ||
      normalized.includes('unstake') ||
      normalized.includes('unlock') ||
      normalized.includes('claim')
    ) {
      return value;
    }

    if (
      normalized.includes('debit') ||
      normalized.includes('lock') ||
      normalized.includes('stake')
    ) {
      return -value;
    }

    return amount;
  }

  private parseSpinStatus(
    status: string | null,
    payoutAmount: number | null,
    topics: string[],
  ): SpinStatus {
    const normalized = `${status || ''} ${topics.join(' ')}`.toLowerCase();
    if (
      normalized.includes('fail') ||
      normalized.includes('error') ||
      normalized.includes('revert')
    ) {
      return SpinStatus.FAILED;
    }
    if (
      normalized.includes('pending') ||
      normalized.includes('processing') ||
      normalized.includes('queued')
    ) {
      return SpinStatus.PENDING;
    }
    if (normalized.includes('complete') || normalized.includes('settle')) {
      return SpinStatus.COMPLETED;
    }
    if (payoutAmount !== null) {
      return SpinStatus.COMPLETED;
    }
    return SpinStatus.PENDING;
  }

  private parseSpinOutcome(value: string | null): SpinOutcome | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    const map: Record<string, SpinOutcome> = {
      jackpot: SpinOutcome.JACKPOT,
      high_win: SpinOutcome.HIGH_WIN,
      highwin: SpinOutcome.HIGH_WIN,
      medium_win: SpinOutcome.MEDIUM_WIN,
      mediumwin: SpinOutcome.MEDIUM_WIN,
      small_win: SpinOutcome.SMALL_WIN,
      smallwin: SpinOutcome.SMALL_WIN,
      no_win: SpinOutcome.NO_WIN,
      nowin: SpinOutcome.NO_WIN,
      loss: SpinOutcome.NO_WIN,
      lose: SpinOutcome.NO_WIN,
    };
    return map[normalized] || null;
  }

  private parseNftTier(value: string | null): NFTTier {
    if (!value) {
      return NFTTier.COMMON;
    }
    const normalized = value.trim().toUpperCase();
    if (normalized === NFTTier.LEGENDARY) return NFTTier.LEGENDARY;
    if (normalized === NFTTier.EPIC) return NFTTier.EPIC;
    if (normalized === NFTTier.RARE) return NFTTier.RARE;
    return NFTTier.COMMON;
  }

  private parseBetStatus(
    statusHint: string | null,
    isWin: boolean | null,
    topics: string[],
  ): BetStatus | null {
    const normalized = `${statusHint || ''} ${topics.join(' ')}`.toLowerCase();

    if (normalized.includes('cancel')) {
      return BetStatus.CANCELLED;
    }

    if (isWin === true) {
      return BetStatus.WON;
    }

    if (isWin === false) {
      return BetStatus.LOST;
    }

    if (normalized.includes('win') || normalized.includes('won')) {
      return BetStatus.WON;
    }
    if (normalized.includes('loss') || normalized.includes('lost')) {
      return BetStatus.LOST;
    }
    if (normalized.includes('pending')) {
      return BetStatus.PENDING;
    }

    return null;
  }

  private async findSpinForEvent(
    manager: EntityManager,
    spinId: string | null,
  ): Promise<Spin | null> {
    if (!spinId) {
      return null;
    }

    const where: FindOptionsWhere<Spin>[] = [
      { id: spinId },
      { sessionId: spinId },
    ];
    return manager.findOne(Spin, {
      where,
      lock: { mode: 'pessimistic_write' },
    });
  }

  private toReferenceId(eventId: string): string {
    return `soroban_event:${eventId}`.slice(0, 255);
  }

  private async ensureCheckpoint(): Promise<ContractEventCheckpoint> {
    let checkpoint = await this.checkpointRepository.findOne({
      where: { id: this.checkpointId },
    });

    if (!checkpoint) {
      checkpoint = this.checkpointRepository.create({
        id: this.checkpointId,
        cursor: null,
        lastLedger: 0,
        lastPolledAt: null,
        lastEventAt: null,
        reconnectCount: 0,
        totalProcessed: 0,
        totalSkipped: 0,
        totalFailed: 0,
        lastError: null,
      });
      checkpoint = await this.checkpointRepository.save(checkpoint);
    }

    return checkpoint;
  }

  private async bootstrapCheckpoint(): Promise<void> {
    const checkpoint = await this.ensureCheckpoint();
    this.cursor = checkpoint.cursor;
    this.lastLedger = checkpoint.lastLedger;

    if (!this.cursor && this.lastLedger <= 0) {
      if (this.configuredStartLedger > 0) {
        this.lastLedger = this.configuredStartLedger;
      } else if (this.server) {
        const latest = await this.server.getLatestLedger();
        this.lastLedger = Math.max(1, latest.sequence - 2);
      }
    }
  }

  private async resetCheckpointToLatestLedger(): Promise<void> {
    if (!this.server) {
      return;
    }

    const latest = await this.server.getLatestLedger();
    this.cursor = null;
    this.lastLedger = Math.max(1, latest.sequence - 1);

    await this.updateCheckpoint({
      cursor: null,
      lastLedger: this.lastLedger,
      lastPolledAt: new Date(),
      lastError: 'Reset checkpoint due to retention window mismatch',
    });

    this.logger.warn(
      `Checkpoint reset to ledger ${this.lastLedger} due to RPC retention window`,
    );
  }

  private async buildGetEventsRequest(): Promise<rpc.Api.GetEventsRequest> {
    const filters: rpc.Api.EventFilter[] = [
      {
        type: 'contract',
        contractIds: [this.contractId],
      },
    ];

    if (this.cursor) {
      return {
        filters,
        cursor: this.cursor,
        limit: this.pageLimit,
      };
    }

    return {
      filters,
      startLedger: Math.max(1, this.lastLedger),
      limit: this.pageLimit,
    };
  }

  private async fetchNormalizedEventsRange(
    startLedger: number,
    endLedger?: number,
    limit?: number,
  ): Promise<{
    events: NormalizedContractEvent[];
    cursor: string | null;
    latestLedger: number;
    oldestLedger: number;
  }> {
    if (!this.server || !this.contractId) {
      throw new ServiceUnavailableException(
        'Soroban event listener is not configured',
      );
    }

    const targetLimit = Math.max(1, Math.min(limit ?? this.pageLimit, 1000));
    const filters: rpc.Api.EventFilter[] = [
      {
        type: 'contract',
        contractIds: [this.contractId],
      },
    ];

    const events: NormalizedContractEvent[] = [];
    let latestLedger = 0;
    let oldestLedger = 0;
    let cursor: string | null = null;
    let request: rpc.Api.GetEventsRequest = {
      filters,
      startLedger: Math.max(1, startLedger),
      endLedger,
      limit: Math.min(this.pageLimit, targetLimit),
    };

    while (events.length < targetLimit) {
      const response = await this.server.getEvents(request);
      latestLedger = response.latestLedger;
      oldestLedger = response.oldestLedger;
      cursor = response.cursor;

      if (response.events.length === 0) {
        break;
      }

      const normalizedEvents = response.events
        .map((event) => this.normalizeEvent(event, response.cursor))
        .filter((event) =>
          endLedger !== undefined ? event.ledger <= endLedger : true,
        );

      events.push(...normalizedEvents);

      const reachedEndLedger =
        endLedger !== undefined &&
        response.events.some((event) => event.ledger >= endLedger);
      if (
        reachedEndLedger ||
        response.events.length < Math.min(this.pageLimit, targetLimit)
      ) {
        break;
      }

      request = {
        filters,
        cursor: response.cursor,
        limit: Math.min(this.pageLimit, targetLimit - events.length),
      };
    }

    return {
      events: events.slice(0, targetLimit),
      cursor,
      latestLedger,
      oldestLedger,
    };
  }

  private async incrementCheckpointFailures(error: unknown): Promise<void> {
    await this.updateCheckpoint({
      failedDelta: 1,
      lastError: this.formatError(error),
      lastPolledAt: new Date(),
    });
  }

  private async markEventFailed(
    event: NormalizedContractEvent,
    errorMessage: string,
  ): Promise<void> {
    await this.eventLogRepository.manager.transaction(async (manager) => {
      const existing = await manager.findOne(ContractEventLog, {
        where: { eventId: event.id },
      });

      const log = existing ?? new ContractEventLog();
      log.eventId = event.id;
      log.eventType = this.classifyEventType(event.topics, event.payload);
      log.ledger = event.ledger;
      log.txHash = event.txHash || null;
      log.cursor = event.cursor;
      log.topics = event.topics;
      log.payload = event.payload;
      log.status = ContractEventStatus.FAILED;
      log.attempts = (log.attempts || 0) + 1;
      log.errorMessage = errorMessage;
      log.processedAt = new Date();

      await manager.save(log);
    });
  }

  private async updateCheckpoint(params: {
    cursor?: string | null;
    lastLedger?: number;
    lastPolledAt?: Date | null;
    lastEventAt?: Date | null;
    lastError?: string | null;
    reconnectCountDelta?: number;
    processedDelta?: number;
    skippedDelta?: number;
    failedDelta?: number;
  }): Promise<void> {
    const checkpoint = await this.ensureCheckpoint();

    if (params.cursor !== undefined) {
      checkpoint.cursor = params.cursor;
    }
    if (params.lastLedger !== undefined) {
      checkpoint.lastLedger = params.lastLedger;
    }
    if (params.lastPolledAt !== undefined) {
      checkpoint.lastPolledAt = params.lastPolledAt;
    }
    if (params.lastEventAt !== undefined) {
      checkpoint.lastEventAt = params.lastEventAt;
    }
    if (params.lastError !== undefined) {
      checkpoint.lastError = params.lastError;
    }
    if (params.reconnectCountDelta) {
      checkpoint.reconnectCount =
        Number(checkpoint.reconnectCount) + params.reconnectCountDelta;
    }
    if (params.processedDelta) {
      checkpoint.totalProcessed =
        Number(checkpoint.totalProcessed) + params.processedDelta;
    }
    if (params.skippedDelta) {
      checkpoint.totalSkipped =
        Number(checkpoint.totalSkipped) + params.skippedDelta;
    }
    if (params.failedDelta) {
      checkpoint.totalFailed =
        Number(checkpoint.totalFailed) + params.failedDelta;
    }

    await this.checkpointRepository.save(checkpoint);
  }

  private isRetentionWindowError(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
      normalized.includes('retention') ||
      normalized.includes('outside of range') ||
      normalized.includes('before oldest ledger') ||
      normalized.includes('startledger')
    );
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
