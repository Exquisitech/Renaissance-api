import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import {
  ContractEventStatus,
} from './entities/contract-event-log.entity';
import { EventListenerService } from './event-listener.service';

class ReplayEventsDto {
  @IsInt()
  @Min(1)
  startLedger: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  endLedger?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  updateCheckpoint?: boolean;
}

class ResetCheckpointDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  startLedger?: number;

  @IsOptional()
  @IsBoolean()
  toLatest?: boolean;
}

@ApiTags('Contract Events Admin')
@Controller('admin/blockchain/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class ContractEventsAdminController {
  constructor(private readonly eventListenerService: EventListenerService) {}

  @Get('checkpoint')
  @ApiOperation({ summary: 'Get Soroban event listener checkpoint state' })
  async getCheckpointState() {
    return this.eventListenerService.getCheckpointState();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get stored contract event logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ContractEventStatus,
  })
  @ApiQuery({ name: 'fromLedger', required: false, type: Number })
  @ApiQuery({ name: 'toLedger', required: false, type: Number })
  async getEventLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: ContractEventStatus,
    @Query('fromLedger') fromLedger?: string,
    @Query('toLedger') toLedger?: string,
  ) {
    return this.eventListenerService.getEventLogs({
      page,
      limit,
      status,
      fromLedger: fromLedger ? Number(fromLedger) : undefined,
      toLedger: toLedger ? Number(toLedger) : undefined,
    });
  }

  @Get('query')
  @ApiOperation({
    summary: 'Query contract events from a specific start ledger',
  })
  async queryEvents(
    @Query('startLedger', ParseIntPipe) startLedger: number,
    @Query('endLedger') endLedger?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventListenerService.queryEventsFromLedger(
      startLedger,
      endLedger ? Number(endLedger) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('gaps')
  @ApiOperation({ summary: 'Detect missing ledger coverage for contract events' })
  async detectGaps(
    @Query('startLedger', ParseIntPipe) startLedger: number,
    @Query('endLedger') endLedger?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventListenerService.detectLedgerGaps(
      startLedger,
      endLedger ? Number(endLedger) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('replay')
  @ApiOperation({ summary: 'Replay missed Soroban contract events' })
  async replayEvents(@Body() body: ReplayEventsDto) {
    return this.eventListenerService.replayEventsFromLedger(body);
  }

  @Post('checkpoint/reset')
  @ApiOperation({ summary: 'Reset the contract event checkpoint for recovery' })
  async resetCheckpoint(@Body() body: ResetCheckpointDto) {
    return this.eventListenerService.resetCheckpoint(body);
  }
}
