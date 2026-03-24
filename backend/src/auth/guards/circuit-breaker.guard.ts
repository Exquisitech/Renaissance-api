import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmergencyPauseService } from '../../admin/emergency-pause.service';
import {
  CRITICAL_ACTION_KEY,
  CriticalActionMetadata,
} from '../../common/decorators/critical-action.decorator';

@Injectable()
export class CircuitBreakerGuard implements CanActivate {
  private readonly logger = new Logger(CircuitBreakerGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly emergencyPauseService: EmergencyPauseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const criticalAction =
      this.reflector.getAllAndOverride<CriticalActionMetadata>(
        CRITICAL_ACTION_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!criticalAction) {
      return true;
    }

    const status = await this.emergencyPauseService.getStatus();
    if (!status.paused) {
      return true;
    }

    this.logger.warn(
      `Blocked critical action '${criticalAction.action}' while emergency pause is active`,
    );

    throw new ServiceUnavailableException({
      message: 'System is temporarily paused',
      action: criticalAction.action,
      pausedAt: status.pausedAt,
      reason: status.reason,
    });
  }
}
