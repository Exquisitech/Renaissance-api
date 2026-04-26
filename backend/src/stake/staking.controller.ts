import { Controller, Post, Get, Body, Param, Patch, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { StakingService } from './staking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Stake } from './entities/stake.entity';
import { StakingTier } from './entities/staking-tier.entity';
import { StakeDelegation } from './entities/stake-delegation.entity';

export class StakeDto {
  @ApiProperty({
    description: 'Player ID to stake for',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  playerId: string;

  @ApiProperty({
    description: 'Amount to stake',
    minimum: 0.0000001,
    example: 1000.5,
  })
  amount: number;

  @ApiProperty({
    description: 'Optional stellar transaction hash for blockchain staking',
    required: false,
    example: 'GA2U5FAMP2W6XL5E4QK5TBC4GZ4I4E5T7X8Y9Z0AB1C2D3E4F5G6H7I8J9K',
  })
  stellarTxHash?: string;

  @ApiProperty({
    description: 'Number of days to lock the stake (0 = no lock)',
    required: false,
    minimum: 0,
    default: 0,
    example: 30,
  })
  lockDays?: number;

  @ApiProperty({
    description: 'Whether to auto-compound rewards',
    required: false,
    default: false,
    example: true,
  })
  autoCompound?: boolean;
}

export class UnstakeDto {
  @ApiProperty({
    description: 'Player ID requesting unstake',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  playerId: string;
}

export class DelegateStakeDto {
  @ApiProperty({
    description: 'Delegator user ID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  delegatorId: string;

  @ApiProperty({
    description: 'Delegatee user ID',
    example: '567e8901-e23c-45e6-b789-012345678901',
  })
  delegateeId: string;

  @ApiProperty({
    description: 'Amount to delegate',
    minimum: 0.0000001,
    example: 500.0,
  })
  amount: number;
}

export class ToggleAutoCompoundDto {
  @ApiProperty({
    description: 'Player ID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  playerId: string;

  @ApiProperty({
    description: 'Enable or disable auto-compound',
    example: true,
  })
  autoCompound: boolean;
}

@ApiTags('Staking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  // ─── Tiers ────────────────────────────────────────────────────────────────────

  @Get('tiers')
  @ApiOperation({
    summary: 'Get staking tiers',
    description: 'Retrieves all available staking tiers with their thresholds and benefits',
  })
  @ApiResponse({
    status: 200,
    description: 'Staking tiers retrieved successfully',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Bronze',
          minStake: 0,
          maxStake: 999,
          multiplier: 1.0,
          color: '#CD7F32',
        },
        {
          id: '234e5678-e90b-12d3-a456-426614174001',
          name: 'Silver',
          minStake: 1000,
          maxStake: 4999,
          multiplier: 1.2,
          color: '#C0C0C0',
        },
        {
          id: '345e6789-e12c-13d4-c567-123456789012',
          name: 'Gold',
          minStake: 5000,
          maxStake: 19999,
          multiplier: 1.5,
          color: '#FFD700',
        },
      ],
    },
  })
  getTiers() {
    return this.stakingService.getTiers();
  }

  // ─── Core staking ────────────────────────────────────────────────────────────

  @Post('stake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Stake tokens',
    description:
      'Stakes an amount for a player, optionally with lock period and auto-compound. Creates a new staking position.',
  })
  @ApiBody({ type: StakeDto })
  @ApiResponse({
    status: 201,
    description: 'Stake created successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        playerId: '456e7890-e12b-34d5-a678-901234567890',
        amount: 1000.5,
        lockedAmount: 1000.5,
        pendingRewards: 0,
        autoCompound: false,
        lockPeriodEnd: '2024-02-28T23:59:59Z',
        status: 'active',
        createdAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - insufficient balance or invalid amount',
    schema: {
      example: {
        statusCode: 400,
        message: 'Insufficient wallet balance or invalid amount',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  stake(@Req() req: Request, @Body() body: StakeDto) {
    const userId = req.user.userId ?? req.user.id;
    return this.stakingService.stake(
      body.playerId,
      body.amount,
      body.stellarTxHash,
      body.lockDays ?? 0,
      body.autoCompound ?? false,
    );
  }

  @Post(':stakeId/unstake')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unstake tokens',
    description:
      'Unstakes a specific staking position. If locked, unstaking returns to pending status until lock period ends.',
  })
  @ApiParam({
    name: 'stakeId',
    description: 'Stake UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UnstakeDto })
  @ApiResponse({
    status: 200,
    description: 'Unstake request successful',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'pending_unstake',
        unlockedAt: '2024-02-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot unstake (not owner or already pending)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Stake not found',
  })
  unstake(@Param('stakeId') stakeId: string, @Body() body: UnstakeDto) {
    return this.stakingService.unstake(body.playerId, stakeId);
  }

  @Post(':stakeId/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Claim staking rewards',
    description: 'Claims accumulated rewards for a specific staking position',
  })
  @ApiParam({
    name: 'stakeId',
    description: 'Stake UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UnstakeDto })
  @ApiResponse({
    status: 200,
    description: 'Rewards claimed successfully',
    schema: {
      example: {
        success: true,
        claimedAmount: 150.5,
        newBalance: 5151.0,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no rewards to claim or invalid stake',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Stake not found',
  })
  claim(@Param('stakeId') stakeId: string, @Body() body: UnstakeDto) {
    return this.stakingService.claimRewards(body.playerId, stakeId);
  }

  @Post(':stakeId/compound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Compound staking rewards',
    description: 'Reinvests accumulated rewards back into the staking principal',
  })
  @ApiParam({
    name: 'stakeId',
    description: 'Stake UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UnstakeDto })
  @ApiResponse({
    status: 200,
    description: 'Rewards compounded successfully',
    schema: {
      example: {
        success: true,
        compoundedAmount: 150.5,
        newStakedAmount: 1151.0,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no rewards to compound or invalid stake',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Stake not found',
  })
  compound(@Param('stakeId') stakeId: string, @Body() body: UnstakeDto) {
    return this.stakingService.compoundRewards(body.playerId, stakeId);
  }

  @Patch(':stakeId/auto-compound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle auto-compound for a stake',
    description: 'Enables or disables automatic compounding of rewards',
  })
  @ApiParam({
    name: 'stakeId',
    description: 'Stake UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: ToggleAutoCompoundDto })
  @ApiResponse({
    status: 200,
    description: 'Auto-compound setting updated',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        autoCompound: true,
        message: 'Auto-compound enabled',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot enable auto-compound on locked stake',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Stake not found',
  })
  setAutoCompound(
    @Param('stakeId') stakeId: string,
    @Body() body: ToggleAutoCompoundDto,
  ) {
    return this.stakingService.setAutoCompound(body.playerId, stakeId, body.autoCompound);
  }

  @Get(':playerId')
  @ApiOperation({
    summary: 'Get player stakes',
    description: 'Retrieves all staking positions for a specific player',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Stakes retrieved successfully',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          playerId: '456e7890-e12b-34d5-a678-901234567890',
          amount: 1000.5,
          lockedAmount: 1000.5,
          pendingRewards: 150.25,
          autoCompound: false,
          lockPeriodEnd: '2024-02-28T23:59:59Z',
          status: 'active',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  getStakes(@Param('playerId') playerId: string) {
    return this.stakingService.getPlayerStakes(playerId);
  }

  // ─── Delegation ───────────────────────────────────────────────────────────────

  @Post('delegate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Delegate stake to another player',
    description:
      'Allows a player to delegate a portion of their stake to another player. Delegator retains ownership but delegatee earns a portion of rewards.',
  })
  @ApiBody({ type: DelegateStakeDto })
  @ApiResponse({
    status: 201,
    description: 'Delegation created successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        delegatorId: '456e7890-e12b-34d5-a678-901234567890',
        delegateeId: '567e8901-e23c-45e6-b789-012345678901',
        amount: 500.0,
        originalStakeId: 'stake_123',
        createdAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - insufficient stake or invalid delegation',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  delegate(@Body() body: DelegateStakeDto) {
    return this.stakingService.delegate(body.delegatorId, body.delegateeId, body.amount);
  }

  @Post('delegate/:delegationId/undelegate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undelegate stake',
    description: 'Cancels an active delegation, returning stake to the original owner',
  })
  @ApiParam({
    name: 'delegationId',
    description: 'Delegation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: { delegatorId: string } })
  @ApiResponse({
    status: 200,
    description: 'Delegation cancelled successfully',
    schema: {
      example: {
        success: true,
        message: 'Delegation cancelled',
        returnedAmount: 500.0,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot undelegate (not owner or already terminated)',
  })
  @ApiResponse({
    status: 404,
    description: 'Delegation not found',
  })
  undelegate(
    @Param('delegationId') delegationId: string,
    @Body() body: { delegatorId: string },
  ) {
    return this.stakingService.undelegate(body.delegatorId, delegationId);
  }

  @Get('delegate/:playerId')
  @ApiOperation({
    summary: 'Get delegations for a player',
    description:
      'Retrieves all delegations where the specified player is either delegator or delegatee',
  })
  @ApiParam({
    name: 'playerId',
    description: 'Player UUID',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Delegations retrieved successfully',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          delegatorId: '456e7890-e12b-34d5-a678-901234567890',
          delegateeId: '567e8901-e23c-45e6-b789-012345678901',
          amount: 500.0,
          status: 'active',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ],
    },
  })
  getDelegations(@Param('playerId') playerId: string) {
    return this.stakingService.getDelegations(playerId);
  }
}
