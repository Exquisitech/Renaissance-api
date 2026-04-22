import { Controller, Get, Param, Post } from '@nestjs/common';
import { StakingService } from './staking.service';

@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  @Get('rewards/:address')
  getRewards(@Param('address') address: string) {
    return this.stakingService.getUserRewards(address);
  }

  @Post('claim/:address')
  claim(@Param('address') address: string) {
    return this.stakingService.claim(address);
  }
}