// withdrawal.service.ts

import { Injectable } from '@nestjs/common';
import { WithdrawalPolicyService } from './withdrawal.policy';
import { Repository } from 'typeorm';
import { Withdrawal } from './withdrawal.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly policy: WithdrawalPolicyService,
    @InjectRepository(Withdrawal)
    private withdrawalRepo: Repository<Withdrawal>,
  ) {}

  async createWithdrawal(user: any, amount: number) {
    // 🔒 Enforce cooldown policy
    await this.policy.enforceCooldown(user);

    // 💸 Create withdrawal
    const withdrawal = this.withdrawalRepo.create({
      userId: user.id,
      amount,
    });

    return this.withdrawalRepo.save(withdrawal);
  }
}