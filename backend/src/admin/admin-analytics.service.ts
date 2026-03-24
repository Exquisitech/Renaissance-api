import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Bet, BetStatus } from '../bets/entities/bet.entity';
import { Spin } from '../spin/entities/spin.entity';
import { SpinSession } from '../spin/entities/spin-session.entity';
import { Match } from '../matches/entities/match.entity';
import type { Cache } from 'cache-manager';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Bet) private betRepo: Repository<Bet>,
    @InjectRepository(Spin) private spinRepo: Repository<Spin>,
    @InjectRepository(SpinSession)
    private spinSessionRepo: Repository<SpinSession>,
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    private cacheManager: Cache,
  ) {}

  async getTotalUsers(): Promise<number> {
    return this.userRepo.count();
  }

  async getTotalStaked(): Promise<number> {
    const result = await this.betRepo
      .createQueryBuilder('bet')
      .select('SUM(bet.amount)', 'sum')
      .getRawOne();
    return Number(result.sum) || 0;
  }

  async getTreasuryBalance(): Promise<number> {
    // Example: sum of all deposits minus withdrawals
    const result = await this.betRepo
      .createQueryBuilder('bet')
      .select('SUM(bet.amount)', 'sum')
      .getRawOne();
    return Number(result.sum) || 0;
  }

  async getSpinRevenueVsPayouts(): Promise<{
    revenue: number;
    payouts: number;
  }> {
    const revenue = await this.spinRepo
      .createQueryBuilder('spin')
      .select('SUM(spin.cost)', 'sum')
      .getRawOne();
    const payouts = await this.spinSessionRepo
      .createQueryBuilder('session')
      .select('SUM(session.payout)', 'sum')
      .getRawOne();

    return {
      revenue: Number(revenue.sum) || 0,
      payouts: Number(payouts.sum) || 0,
    };
  }

  async getOpenBets(): Promise<number> {
    return this.betRepo.count({ where: { status: BetStatus.PENDING } });
  }

  async getSuspiciousUsers(): Promise<User[]> {
    // Note: flaggedSuspicious field doesn't exist in User entity
    // This method returns empty array until the field is added
    return [];
  }
}
