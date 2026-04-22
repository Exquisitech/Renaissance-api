import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StakingService } from '../staking.service';

@Injectable()
export class StakingCronService {
  constructor(private readonly stakingService: StakingService) {}

  @Cron('0 * * * *') // every hour
  async distributeRewards() {
    // fetch active stakers from DB later
    console.log('Running staking reward distribution...');
  }
}