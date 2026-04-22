import { Controller, Get, Query, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SolvencyService } from './solvency.service';
import { SolvencyMetricsDto } from './solvency-metrics.dto';

@ApiTags('Solvency')
@Controller('solvency')
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

  @Post('generate-proof')
  @ApiOperation({ summary: 'Generate proof of reserves' })
  @ApiResponse({ status: 201, description: 'Proof generated successfully' })
  async generateProof(
    @Query('publish') publish: boolean = true,
  ): Promise<any> {
    const proof = await this.solvencyService.generateProofOfReserves(publish);
    return {
      success: true,
      proofId: proof.id,
      merkleRoot: proof.merkleRoot,
      status: proof.status,
      transactionHash: proof.transactionHash,
    };
  }

  @Get('proofs')
  @ApiOperation({ summary: 'Get historical solvency proofs' })
  @ApiResponse({ status: 200, description: 'List of historical proofs' })
  async getHistoricalProofs(
    @Query('limit') limit: number = 10,
  ): Promise<any[]> {
    return this.solvencyService.getHistoricalProofs(limit);
  }

  @Get('verify/:userId')
  @ApiOperation({ summary: 'Verify user solvency proof' })
  @ApiResponse({ status: 200, description: 'Verification result' })
  async verifyProof(
    @Param('userId') userId: string,
    @Query('proofId') proofId: string,
  ): Promise<any> {
    const result = await this.solvencyService.verifyUserProof(userId, proofId);
    return {
      verified: result.verified,
      balance: result.balance,
      merkleRoot: result.merkleRoot,
    };
  }
}
