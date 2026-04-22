import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import { DistributePrizesDto, WinnerDto } from './dto/treasury.dto';
import { DistributionBatchStatus } from './entities/treasury-distribution-batch.entity';

@Controller('treasury')
export class TreasuryController {
  private readonly logger = new Logger(TreasuryController.name);

  constructor(private readonly treasuryService: TreasuryService) {}

  @Get('winners')
  async getWinners(
    @Query('matchId') matchId?: string,
    @Query('limit') limit: number = 1000,
  ): Promise<WinnerDto[]> {
    return this.treasuryService.aggregateWinners(matchId, limit);
  }

  @Post('distribute')
  async distributePrizes(
    @Body() dto: DistributePrizesDto,
  ): Promise<{
    batchId: string;
    status: DistributionBatchStatus;
    totalDistributed: number;
    failedCount: number;
  }> {
    const winners = await this.treasuryService.aggregateWinners();
    
    return this.treasuryService.distributeToWinners(
      winners,
      dto.allowPartialDistribution ?? true,
    );
  }

  @Post('distribute/batch')
  async distributeSpecificWinners(
    @Body('winners') winners: WinnerDto[],
    @Body('allowPartialDistribution') allowPartialDistribution: boolean = true,
  ): Promise<{
    batchId: string;
    status: DistributionBatchStatus;
    totalDistributed: number;
    failedCount: number;
  }> {
    return this.treasuryService.distributeToWinners(
      winners,
      allowPartialDistribution,
    );
  }

  @Get('batch/:batchId')
  async getBatchDetails(@Param('batchId') batchId: string): Promise<any> {
    return this.treasuryService.getBatchDetails(batchId);
  }

  @Get('audit')
  async getAuditLogs(
    @Query('batchId') batchId?: string,
    @Query('distributionId') distributionId?: string,
  ): Promise<any[]> {
    return this.treasuryService.getAuditLogs(batchId, distributionId);
  }
}
