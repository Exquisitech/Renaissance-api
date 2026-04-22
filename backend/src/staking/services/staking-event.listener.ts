import { Injectable, OnModuleInit } from '@nestjs/common';
import { StakingContractService } from './staking-contract.service';

@Injectable()
export class StakingEventListener implements OnModuleInit {
  constructor(private readonly contract: StakingContractService) {}

  onModuleInit() {
    this.contract['contract'].on('RewardClaimed', (user, amount) => {
      console.log(`Reward claimed: ${user} -> ${amount}`);
    });
  }
}