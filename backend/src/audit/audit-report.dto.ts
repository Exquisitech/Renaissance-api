import { ApiProperty } from '@nestjs/swagger';

export class AuditViolationDto {
  @ApiProperty()
  type: string;
  @ApiProperty()
  message: string;
  @ApiProperty({ enum: ['CRITICAL', 'WARNING', 'INFO'] })
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  @ApiProperty({ required: false })
  details?: any;
}

export class AuditReportDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  status: string;
  @ApiProperty({ type: [AuditViolationDto] })
  violations: AuditViolationDto[];
  @ApiProperty()
  createdAt: Date;
}
