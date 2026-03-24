import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AdminAuditService } from '../services/admin-audit.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly auditService: AdminAuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditAction = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!auditAction) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (response) => {
          try {
            const executionTime = Date.now() - startTime;

            await this.auditService.logAction({
              userId: user.id,
              action: auditAction,
              targetUserId: request.params?.userId || request.body?.userId,
              targetResource: this.getResourceFromPath(request.path),
              resourceId: request.params?.id,
              changes: this.extractChanges(request.body),
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              metadata: {
                method: request.method,
                path: request.path,
                executionTime,
                statusCode: 200,
              },
            });
          } catch (error) {
            this.logger.error('Failed to log audit action', error);
          }
        },
        error: async (error) => {
          try {
            await this.auditService.logAction({
              userId: user.id,
              action: `${auditAction}_FAILED`,
              targetUserId: request.params?.userId || request.body?.userId,
              targetResource: this.getResourceFromPath(request.path),
              resourceId: request.params?.id,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              metadata: {
                method: request.method,
                path: request.path,
                error: error.message,
                statusCode: error.status || 500,
              },
            });
          } catch (auditError) {
            this.logger.error('Failed to log audit action error', auditError);
          }
        },
      }),
    );
  }

  private getResourceFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[0] || 'unknown';
  }

  private extractChanges(body: any): Record<string, any> | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    // Remove sensitive fields
    const { password, token, secret, ...changes } = body;
    return Object.keys(changes).length > 0 ? changes : undefined;
  }
}
