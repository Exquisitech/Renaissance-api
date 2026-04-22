import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  Webhook,
  WebhookSubscription,
  WebhookDeliveryLog,
  WebhookEvent,
  WebhookStatus,
  DeliveryStatus,
} from './entities';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
  ) {}

  // ==================== Webhook Configuration ====================

  async createWebhook(createDto: CreateWebhookDto): Promise<Webhook> {
    const secret = this.generateSecret();
    
    const webhook = this.webhookRepository.create({
      name: createDto.name,
      url: createDto.url,
      description: createDto.description,
      isEnabled: createDto.isEnabled ?? true,
      retryAttempts: createDto.retryAttempts ?? 3,
      timeoutMs: createDto.timeoutMs ?? 1000,
      secret,
      status: WebhookStatus.ACTIVE,
    });

    const savedWebhook = await this.webhookRepository.save(webhook);

    // Create subscriptions for each event
    for (const event of createDto.events) {
      const subscription = this.subscriptionRepository.create({
        webhookId: savedWebhook.id,
        event,
        isActive: true,
      });
      await this.subscriptionRepository.save(subscription);
    }

    this.logger.log(`Created webhook: ${savedWebhook.id} - ${savedWebhook.name}`);
    return savedWebhook;
  }

  async updateWebhook(id: string, updateDto: UpdateWebhookDto): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    Object.assign(webhook, updateDto);
    return this.webhookRepository.save(webhook);
  }

  async deleteWebhook(id: string): Promise<void> {
    const result = await this.webhookRepository.delete(id);
    if (result.affected === 0) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }
    this.logger.log(`Deleted webhook: ${id}`);
  }

  async getWebhooks(): Promise<Webhook[]> {
    return this.webhookRepository.find({
      relations: ['subscriptions'],
      order: { createdAt: 'DESC' },
    });
  }

  async getWebhookById(id: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id },
      relations: ['subscriptions', 'deliveryLogs'],
    });
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }
    return webhook;
  }

  async toggleWebhook(id: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    webhook.isEnabled = !webhook.isEnabled;
    webhook.status = webhook.isEnabled ? WebhookStatus.ACTIVE : WebhookStatus.INACTIVE;
    return this.webhookRepository.save(webhook);
  }

  async regenerateSecret(id: string): Promise<string> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    webhook.secret = this.generateSecret();
    await this.webhookRepository.save(webhook);
    return webhook.secret;
  }

  // ==================== Event Subscriptions ====================

  async updateSubscriptions(webhookId: string, events: WebhookEvent[]): Promise<WebhookSubscription[]> {
    // Remove existing subscriptions
    await this.subscriptionRepository.delete({ webhookId });

    // Create new subscriptions
    const subscriptions: WebhookSubscription[] = [];
    for (const event of events) {
      const subscription = this.subscriptionRepository.create({
        webhookId,
        event,
        isActive: true,
      });
      subscriptions.push(await this.subscriptionRepository.save(subscription));
    }

    return subscriptions;
  }

  // ==================== Webhook Signing ====================

  generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ==================== Event Triggering ====================

  async triggerEvent(event: WebhookEvent, payload: object): Promise<void> {
    this.logger.log(`Triggering event: ${event}`);

    // Get all active subscriptions for this event
    const subscriptions = await this.subscriptionRepository.find({
      where: { event, isActive: true },
      relations: ['webhook'],
    });

    for (const subscription of subscriptions) {
      const webhook = subscription.webhook;
      
      // Skip if webhook is not enabled
      if (!webhook.isEnabled || webhook.status !== WebhookStatus.ACTIVE) {
        continue;
      }

      // Create delivery log
      const payloadString = JSON.stringify(payload);
      const signature = this.generateSignature(payloadString, webhook.secret);

      const deliveryLog = this.deliveryLogRepository.create({
        webhookId: webhook.id,
        subscriptionId: subscription.id,
        event,
        payload: payloadString,
        status: DeliveryStatus.PENDING,
        attemptCount: 0,
        signature,
      });

      await this.deliveryLogRepository.save(deliveryLog);

      // Attempt delivery
      await this.deliverWebhook(deliveryLog, webhook, payloadString);
    }
  }

  // ==================== Webhook Delivery ====================

  private async deliverWebhook(
    deliveryLog: WebhookDeliveryLog,
    webhook: Webhook,
    payload: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const response = await axios.post(webhook.url, JSON.parse(payload), {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': deliveryLog.signature,
          'X-Webhook-Event': deliveryLog.event,
          'X-Webhook-Delivery-Id': deliveryLog.id,
        },
        timeout: webhook.timeoutMs,
        validateStatus: () => true, // Accept any status code
      });

      deliveryLog.responseStatus = response.status;
      deliveryLog.responseBody = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
      deliveryLog.duration = Date.now() - startTime;
      deliveryLog.lastAttemptAt = new Date();

      if (response.status >= 200 && response.status < 300) {
        deliveryLog.status = DeliveryStatus.SUCCESS;
        this.logger.log(`Webhook delivered successfully: ${webhook.id}`);
      } else {
        deliveryLog.status = DeliveryStatus.FAILED;
        deliveryLog.errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        await this.scheduleRetry(deliveryLog, webhook);
      }
    } catch (error) {
      deliveryLog.status = DeliveryStatus.FAILED;
      deliveryLog.errorMessage = error.message;
      deliveryLog.duration = Date.now() - startTime;
      deliveryLog.lastAttemptAt = new Date();
      
      await this.scheduleRetry(deliveryLog, webhook);
    }

    await this.deliveryLogRepository.save(deliveryLog);
  }

  // ==================== Retry Logic ====================

  private async scheduleRetry(deliveryLog: WebhookDeliveryLog, webhook: Webhook): Promise<void> {
    deliveryLog.attemptCount++;
    deliveryLog.status = DeliveryStatus.RETRYING;

    if (deliveryLog.attemptCount < webhook.retryAttempts) {
      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      const delayMs = Math.pow(2, deliveryLog.attemptCount - 1) * 1000;
      deliveryLog.nextRetryAt = new Date(Date.now() + delayMs);
      this.logger.log(`Scheduling retry ${deliveryLog.attemptCount} for delivery ${deliveryLog.id} in ${delayMs}ms`);
    } else {
      deliveryLog.status = DeliveryStatus.FAILED;
      deliveryLog.errorMessage = `Max retries (${webhook.retryAttempts}) exceeded`;
      this.logger.error(`Max retries exceeded for delivery ${deliveryLog.id}`);
    }

    await this.deliveryLogRepository.save(deliveryLog);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processRetries(): Promise<void> {
    const pendingRetries = await this.deliveryLogRepository.find({
      where: {
        status: DeliveryStatus.RETRYING,
      },
      relations: ['webhook'],
    });

    const now = new Date();
    for (const delivery of pendingRetries) {
      if (delivery.nextRetryAt && delivery.nextRetryAt <= now) {
        const webhook = delivery.webhook;
        await this.deliverWebhook(delivery, webhook, delivery.payload);
      }
    }
  }

  // ==================== Delivery Logs ====================

  async getDeliveryLogs(query: {
    webhookId?: string;
    event?: WebhookEvent;
    status?: DeliveryStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: WebhookDeliveryLog[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.webhookId) where.webhookId = query.webhookId;
    if (query.event) where.event = query.event;
    if (query.status) where.status = query.status;

    const [data, total] = await this.deliveryLogRepository.findAndCount({
      where,
      relations: ['webhook'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getDeliveryLogById(id: string): Promise<WebhookDeliveryLog> {
    const deliveryLog = await this.deliveryLogRepository.findOne({
      where: { id },
      relations: ['webhook', 'webhook.subscriptions'],
    });
    if (!deliveryLog) {
      throw new HttpException('Delivery log not found', HttpStatus.NOT_FOUND);
    }
    return deliveryLog;
  }

  async retryDelivery(id: string): Promise<WebhookDeliveryLog> {
    const deliveryLog = await this.deliveryLogRepository.findOne({
      where: { id },
      relations: ['webhook'],
    });
    if (!deliveryLog) {
      throw new HttpException('Delivery log not found', HttpStatus.NOT_FOUND);
    }

    deliveryLog.status = DeliveryStatus.PENDING;
    deliveryLog.attemptCount = 0;
    deliveryLog.nextRetryAt = null;
    deliveryLog.errorMessage = null;

    await this.deliveryLogRepository.save(deliveryLog);
    await this.deliverWebhook(deliveryLog, deliveryLog.webhook, deliveryLog.payload);

    return this.getDeliveryLogById(id);
  }

  // ==================== Health Monitoring ====================

  async checkWebhookHealth(id: string): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    const testPayload = JSON.stringify({ event: 'health.check', timestamp: new Date().toISOString() });
    const signature = this.generateSignature(testPayload, webhook.secret);
    const startTime = Date.now();

    try {
      await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'health.check',
        },
        timeout: webhook.timeoutMs,
        validateStatus: () => true,
      });

      const latency = Date.now() - startTime;
      
      webhook.healthStatus = true;
      webhook.lastHealthCheck = new Date();
      await this.webhookRepository.save(webhook);

      return { healthy: true, latency };
    } catch (error) {
      webhook.healthStatus = false;
      webhook.lastHealthCheck = new Date();
      await this.webhookRepository.save(webhook);

      return { healthy: false, error: error.message };
    }
  }

  async getWebhookStats(id: string): Promise<{
    totalDeliveries: number;
    successRate: number;
    averageLatency: number;
    lastDelivery: Date | null;
  }> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    const deliveries = await this.deliveryLogRepository.find({
      where: { webhookId: id },
    });

    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(d => d.status === DeliveryStatus.SUCCESS).length;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    const latencies = deliveries.filter(d => d.duration).map(d => d.duration);
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    const sortedDeliveries = deliveries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      totalDeliveries,
      successRate: Math.round(successRate * 100) / 100,
      averageLatency: Math.round(averageLatency),
      lastDelivery: sortedDeliveries.length > 0 ? sortedDeliveries[0].createdAt : null,
    };
  }

  // ==================== Get Available Events ====================

  getAvailableEvents(): { value: string; label: string; category: string }[] {
    return [
      // Betting events
      { value: WebhookEvent.BET_PLACED, label: 'Bet Placed', category: 'Betting' },
      { value: WebhookEvent.BET_SETTLED, label: 'Bet Settled', category: 'Betting' },
      { value: WebhookEvent.BET_CANCELLED, label: 'Bet Cancelled', category: 'Betting' },
      
      // Transaction events
      { value: WebhookEvent.DEPOSIT_COMPLETED, label: 'Deposit Completed', category: 'Transactions' },
      { value: WebhookEvent.WITHDRAWAL_COMPLETED, label: 'Withdrawal Completed', category: 'Transactions' },
      { value: WebhookEvent.WITHDRAWAL_FAILED, label: 'Withdrawal Failed', category: 'Transactions' },
      
      // User events
      { value: WebhookEvent.USER_REGISTERED, label: 'User Registered', category: 'Users' },
      { value: WebhookEvent.USER_KYC_APPROVED, label: 'KYC Approved', category: 'Users' },
      { value: WebhookEvent.USER_KYC_REJECTED, label: 'KYC Rejected', category: 'Users' },
      
      // Game events
      { value: WebhookEvent.JACKPOT_WIN, label: 'Jackpot Win', category: 'Games' },
      { value: WebhookEvent.SPIN_COMPLETED, label: 'Spin Completed', category: 'Games' },
      
      // Admin events
      { value: WebhookEvent.EMERGENCY_PAUSE, label: 'Emergency Pause', category: 'Admin' },
      { value: WebhookEvent.EMERGENCY_UNPAUSE, label: 'Emergency Unpause', category: 'Admin' },
      
      // System events
      { value: WebhookEvent.SYSTEM_ALERT, label: 'System Alert', category: 'System' },
    ];
  }
}