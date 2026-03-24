import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditReport } from './audit-report.entity';
import { AuditService } from './audit.service';
import { AuditScheduler } from './audit.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([AuditReport])],
  providers: [AuditService, AuditScheduler],
  exports: [AuditService],
})
export class AuditModule {}
