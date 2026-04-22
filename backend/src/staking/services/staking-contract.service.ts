import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class StakingContractService {
  private contract: ethers.Contract;

  constructor() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    this.contract = new ethers.Contract(
      process.env.STAKING_CONTRACT_ADDRESS!,
      require('../../../../contract/contracts/staking/abi.json'),
      provider
    );
  }

  async getUserStake(userAddress: string) {
    return this.contract.stakes(userAddress);
  }

  async getRewardRate() {
    return this.contract.rewardRate();
  }

  async claimRewards(signer: ethers.Wallet, userAddress: string) {
    return this.contract.connect(signer).claim(userAddress);
  }
}