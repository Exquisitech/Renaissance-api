import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventBus } from '@nestjs/cqrs';
import { Repository } from 'typeorm';
import { SystemControl } from './entities/system-control.entity';
import { EmergencyPausedEvent } from './domain/events/emergency-paused.event';
import { EmergencyUnpausedEvent } from './domain/events/emergency-unpaused.event';

const GLOBAL_PAUSE_KEY = 'global_pause';

export interface EmergencyPauseStatus {
  paused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  reason: string | null;
}

@Injectable()
export class EmergencyPauseService {
  private readonly logger = new Logger(EmergencyPauseService.name);

  constructor(
    @InjectRepository(SystemControl)
    private readonly systemControlRepository: Repository<SystemControl>,
    private readonly eventBus: EventBus,
  ) {}

  async getStatus(): Promise<EmergencyPauseStatus> {
    const control = await this.getOrCreateGlobalControl();
    return {
      paused: control.isPaused,
      pausedAt: control.pausedAt?.toISOString() ?? null,
      pausedBy: control.pausedBy,
      reason: control.pauseReason,
    };
  }

  async isPaused(): Promise<boolean> {
    const control = await this.getOrCreateGlobalControl();
    return control.isPaused;
  }

  async pause(
    reason: string,
    pausedBy: string | null,
  ): Promise<EmergencyPauseStatus> {
    const control = await this.getOrCreateGlobalControl();
    const now = new Date();

    control.isPaused = true;
    control.pausedAt = now;
    control.pausedBy = pausedBy;
    control.pauseReason = reason;
    control.lastUpdatedBy = pausedBy;

    await this.systemControlRepository.save(control);
    this.eventBus.publish(
      new EmergencyPausedEvent(pausedBy, reason, now.toISOString()),
    );
    this.logger.warn(
      `Global emergency pause enabled by ${pausedBy ?? 'unknown'}: ${reason}`,
    );

    return this.getStatus();
  }

  async unpause(
    reason: string,
    unpausedBy: string | null,
  ): Promise<EmergencyPauseStatus> {
    const control = await this.getOrCreateGlobalControl();
    const now = new Date();

    control.isPaused = false;
    control.pausedAt = null;
    control.pausedBy = null;
    control.pauseReason = null;
    control.lastUpdatedBy = unpausedBy;

    await this.systemControlRepository.save(control);
    this.eventBus.publish(
      new EmergencyUnpausedEvent(unpausedBy, reason, now.toISOString()),
    );
    this.logger.warn(
      `Global emergency pause disabled by ${unpausedBy ?? 'unknown'}: ${reason}`,
    );

    return this.getStatus();
  }

  private async getOrCreateGlobalControl(): Promise<SystemControl> {
    const existing = await this.systemControlRepository.findOne({
      where: { key: GLOBAL_PAUSE_KEY },
    });

    if (existing) {
      return existing;
    }

    const created = this.systemControlRepository.create({
      key: GLOBAL_PAUSE_KEY,
      isPaused: false,
      pausedAt: null,
      pausedBy: null,
      pauseReason: null,
      lastUpdatedBy: null,
    });
    return this.systemControlRepository.save(created);
  }
}
