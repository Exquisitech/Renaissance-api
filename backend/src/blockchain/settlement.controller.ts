import {
  Controller,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { BackendExecutorAction } from '../auth/decorators/contract-roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CriticalAction } from '../common/decorators/critical-action.decorator';

class SettleBetDto {
  outcome: string;
  amount: number;
}

@ApiTags('Blockchain Settlement')
@Controller('blockchain/settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * Settle a bet on the blockchain
   * POST /blockchain/settlement/bets/:betId/settle
   * Requires BACKEND_EXECUTOR or ADMIN role
   */
  @Post('bets/:betId/settle')
  @CriticalAction('blockchain.settlement.settle_bet')
  @BackendExecutorAction('settle_bet')
  @ApiParam({ name: 'betId', description: 'Bet ID to settle' })
  @ApiOperation({
    summary: 'Settle a bet on blockchain',
    description:
      'Initiate settlement for a bet. Requires BACKEND_EXECUTOR or ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settlement initiated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires BACKEND_EXECUTOR or ADMIN role',
  })
  async settleBet(
    @Param('betId', ParseUUIDPipe) betId: string,
    @Body() dto: SettleBetDto,
  ): Promise<Settlement> {
    return this.settlementService.settleBet(betId, dto.outcome, dto.amount);
  }

  /**
   * Trigger reconciliation of pending settlements
   * POST /blockchain/settlement/reconcile
   * Requires BACKEND_EXECUTOR or ADMIN role
   */
  @Post('reconcile')
  @CriticalAction('blockchain.settlement.reconcile')
  @BackendExecutorAction('reconcile_settlements')
  @ApiOperation({
    summary: 'Reconcile pending settlements',
    description:
      'Check and update status of pending blockchain settlements. Requires BACKEND_EXECUTOR or ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation completed',
  })
  async reconcile(): Promise<{ message: string; processed: number }> {
    const pendingSettlements =
      await this.settlementService.getPendingSettlements();
    await this.settlementService.reconcile();
    return {
      message: 'Reconciliation completed successfully',
      processed: pendingSettlements.length,
    };
  }

  /**
   * Get pending settlements
   * GET /blockchain/settlement/pending
   * Requires BACKEND_EXECUTOR or ADMIN role
   */
  @Get('pending')
  @BackendExecutorAction('view_pending_settlements')
  @ApiOperation({
    summary: 'Get pending settlements',
    description: 'List all settlements awaiting blockchain confirmation.',
  })
  async getPendingSettlements(): Promise<Settlement[]> {
    return this.settlementService.getPendingSettlements();
  }

  /**
   * Get settlement by ID
   * GET /blockchain/settlement/:id
   * Requires BACKEND_EXECUTOR or ADMIN role
   */
  @Get(':id')
  @BackendExecutorAction('view_settlement')
  @ApiParam({ name: 'id', description: 'Settlement ID' })
  @ApiOperation({
    summary: 'Get settlement details',
    description: 'Get details of a specific settlement.',
  })
  async getSettlement(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Settlement | null> {
    return this.settlementService.getSettlementById(id);
  }
}
