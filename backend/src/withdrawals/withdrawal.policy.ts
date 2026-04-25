// withdrawal.policy.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Withdrawal } from './withdrawal.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { UserTier } from '../users/user-tier.enum';

@Injectable()
export class WithdrawalPolicyService {
  constructor(
    @InjectRepository(Withdrawal)
    private withdrawalRepo: Repository<Withdrawal>,
  ) {}

  // Configurable cooldown per tier (in hours)
  private cooldownByTier: Record<UserTier, number> = {
    [UserTier.BASIC]: 24,
    [UserTier.PREMIUM]: 12,
    [UserTier.VIP]: 0, // VIP = no cooldown
  };

  async enforceCooldown(user: {
    id: string;
    tier: UserTier;
    isWhitelisted: boolean;
  }) {
    // ✅ Whitelisted users bypass everything
    if (user.isWhitelisted) return;

    const cooldownHours = this.cooldownByTier[user.tier];

    // No cooldown for this tier
    if (cooldownHours === 0) return;

    const withdrawals = await this.withdrawalRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
    });

    // If no withdrawals yet → allow first withdrawal
    if (withdrawals.length === 0) return;

    const firstWithdrawal = withdrawals[0];
    const now = new Date();

    const cooldownEnd = new Date(
      firstWithdrawal.createdAt.getTime() +
        cooldownHours * 60 * 60 * 1000,
    );

    if (now < cooldownEnd) {
      const remainingMs = cooldownEnd.getTime() - now.getTime();

      throw new ForbiddenException({
        message: 'Withdrawal cooldown active',
        remainingSeconds: Math.ceil(remainingMs / 1000),
      });
    }
  }
}