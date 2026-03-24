import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from '../../admin/entities/admin-audit-log.entity';
import { Permission } from '../enums/admin-role.enum';

export interface AuditLogData {
  userId: string;
  action: string;
  permission?: Permission;
  targetUserId?: string;
  targetResource?: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepo: Repository<AdminAuditLog>,
  ) {}

  async logAction(data: AuditLogData): Promise<AdminAuditLog> {
    try {
      const auditLog = this.auditLogRepo.create({
        adminId: data.userId,
        actionType: data.action as any,
        affectedUserId: data.targetUserId,
        affectedEntityType: data.targetResource,
        affectedEntityId: data.resourceId,
        previousValues: data.changes,
        metadata: {
          ...data.metadata,
          permission: data.permission,
          timestamp: new Date().toISOString(),
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      const saved = await this.auditLogRepo.save(auditLog);

      this.logger.log(
        `Audit log created: ${data.action} by user ${data.userId}`,
      );

      return saved;
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
      throw error;
    }
  }

  async getAuditLogs(filters: {
    userId?: string;
    targetUserId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AdminAuditLog[]; total: number }> {
    const query = this.auditLogRepo.createQueryBuilder('audit');

    if (filters.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters.targetUserId) {
      query.andWhere('audit.targetUserId = :targetUserId', {
        targetUserId: filters.targetUserId,
      });
    }

    if (filters.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters.startDate) {
      query.andWhere('audit.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      query.andWhere('audit.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    query.orderBy('audit.createdAt', 'DESC');

    const total = await query.getCount();

    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    const logs = await query.getMany();

    return { logs, total };
  }

  async getUserActivitySummary(
    userId: string,
    days: number = 30,
  ): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.auditLogRepo
      .createQueryBuilder('audit')
      .where('audit.adminId = :userId', { userId })
      .andWhere('audit.createdAt >= :startDate', { startDate })
      .getMany();

    const actionCounts = logs.reduce(
      (acc, log) => {
        acc[log.actionType] = (acc[log.actionType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      userId,
      period: `Last ${days} days`,
      totalActions: logs.length,
      actionBreakdown: actionCounts,
      lastActivity: logs[0]?.createdAt,
    };
  }
}
