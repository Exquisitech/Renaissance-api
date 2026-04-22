import { Injectable } from '@nestjs/common';
import { StakingContractService } from './staking-contract.service';
import { ethers } from 'ethers';

@Injectable()
export class RewardDistributorService {
  constructor(private readonly contractService: StakingContractService) {}

  async distribute(userAddress: string) {
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.contractService['contract'].runner);

    return this.contractService.claimRewards(wallet, userAddress);
  }
}