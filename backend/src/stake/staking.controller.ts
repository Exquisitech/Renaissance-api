import { Controller, Post, Get, Body, Param, Patch } from '@nestjs/common';
import { StakingService } from './staking.service';

@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  // ─── Tiers (#357) ─────────────────────────────────────────────────────────

  @Get('tiers')
  getTiers() {
    return this.stakingService.getTiers();
  }

  // ─── Core staking ─────────────────────────────────────────────────────────

  @Post('stake')
  stake(
    @Body()
    body: {
      playerId: string;
      amount: number;
      stellarTxHash?: string;
      lockDays?: number;   // #357
      autoCompound?: boolean; // #358
    },
  ) {
    return this.stakingService.stake(
      body.playerId,
      body.amount,
      body.stellarTxHash,
      body.lockDays ?? 0,
      body.autoCompound ?? false,
    );
  }

  @Post(':stakeId/unstake')
  unstake(@Param('stakeId') stakeId: string, @Body() body: { playerId: string }) {
    return this.stakingService.unstake(body.playerId, stakeId);
  }

  @Post(':stakeId/claim')
  claim(@Param('stakeId') stakeId: string, @Body() body: { playerId: string }) {
    return this.stakingService.claimRewards(body.playerId, stakeId);
  }

  @Post(':stakeId/compound')
  compound(@Param('stakeId') stakeId: string, @Body() body: { playerId: string }) {
    return this.stakingService.compoundRewards(body.playerId, stakeId);
  }

  /** #358: Toggle auto-compound per stake */
  @Patch(':stakeId/auto-compound')
  setAutoCompound(
    @Param('stakeId') stakeId: string,
    @Body() body: { playerId: string; autoCompound: boolean },
  ) {
    return this.stakingService.setAutoCompound(body.playerId, stakeId, body.autoCompound);
  }

  @Get(':playerId')
  getStakes(@Param('playerId') playerId: string) {
    return this.stakingService.getPlayerStakes(playerId);
  }

  // ─── Delegation (#356) ────────────────────────────────────────────────────

  @Post('delegate')
  delegate(@Body() body: { delegatorId: string; delegateeId: string; amount: number }) {
    return this.stakingService.delegate(body.delegatorId, body.delegateeId, body.amount);
  }

  @Post('delegate/:delegationId/undelegate')
  undelegate(
    @Param('delegationId') delegationId: string,
    @Body() body: { delegatorId: string },
  ) {
    return this.stakingService.undelegate(body.delegatorId, delegationId);
  }

  @Get('delegate/:playerId')
  getDelegations(@Param('playerId') playerId: string) {
    return this.stakingService.getDelegations(playerId);
  }
}
