import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
// import { AnalyticsService } from './analytics.service';
import { DateRangeDto } from './dto/date-range.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import type { Response } from 'express';
import { Parser } from 'json2csv';
import { AnalyticsService } from './providers/analytics.service';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('staked')
  async totalStaked(
    @Query() dateRange: DateRangeDto,
    @Query() exportQuery: ExportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.analyticsService.totalStaked(dateRange);

    if (exportQuery.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse([data]);
      res.header('Content-Type', 'text/csv');
      res.attachment('total-staked.csv');
      return res.send(csv);
    }

    return res.json(data);
  }

  @Get('spin')
  async spinRevenue(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.spinRevenue(dateRange);
  }

  @Get('popular-nfts')
  async mostPopular() {
    return this.analyticsService.mostPopularNFTs();
  }

  @Get('bet-settlement')
  async betStats(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.betSettlementStats(dateRange);
  }
}
