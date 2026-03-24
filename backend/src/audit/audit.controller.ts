import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditReportDto } from './audit-report.dto';
import { MoreThan } from 'typeorm';

@ApiTags('Admin')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get latest audit report' })
  @ApiResponse({ status: 200, type: AuditReportDto })
  async getLatest(): Promise<AuditReportDto | null> {
    const report = await this.auditService['reportRepo'].findOne({
      order: { createdAt: 'DESC' },
    });
    return report;
  }

  @Get('history')
  @ApiOperation({ summary: 'Get audit report history' })
  @ApiResponse({ status: 200, type: [AuditReportDto] })
  async getHistory(@Query('days') days = 30): Promise<AuditReportDto[]> {
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    return this.auditService['reportRepo'].find({
      where: { createdAt: MoreThan(since) },
      order: { createdAt: 'DESC' },
    });
  }
}
