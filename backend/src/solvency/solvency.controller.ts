import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SolvencyService } from './solvency.service';
import { SolvencyMetricsDto } from './solvency-metrics.dto';

@ApiTags('Admin')
@Controller('admin/solvency')
export class SolvencyController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get latest solvency metrics' })
  @ApiResponse({ status: 200, type: SolvencyMetricsDto })
  async getLatest(): Promise<SolvencyMetricsDto> {
    return this.solvencyService.getLatestMetrics();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get solvency metrics history' })
  @ApiResponse({ status: 200, type: [SolvencyMetricsDto] })
  async getHistory(@Query('days') days = 30): Promise<SolvencyMetricsDto[]> {
    return this.solvencyService.getMetricsHistory(Number(days));
  }
}
