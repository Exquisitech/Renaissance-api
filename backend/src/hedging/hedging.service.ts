// hedging.service.ts

import { Injectable } from '@nestjs/common';
import { BetSide, HedgeResult } from './hedging.types';
import { Repository } from 'typeorm';
import { Hedge } from './hedging.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class HedgingService {
  private readonly THRESHOLD = 1000; // XLM (can be config-driven)

  constructor(
    @InjectRepository(Hedge)
    private hedgeRepo: Repository<Hedge>,
  ) {}

  async autoHedge(bet: {
    id: string;
    amount: number;
    odds: number;
    side: BetSide;
  }): Promise<HedgeResult | null> {
    if (bet.amount < this.THRESHOLD) {
      return null;
    }

    const hedgeSide = this.getOppositeSide(bet.side);

    const hedgeAmount = this.calculateHedgeAmount(
      bet.amount,
      bet.odds,
    );

    const hedgeBet = await this.placeHedgeBet({
      originalBetId: bet.id,
      amount: hedgeAmount,
      side: hedgeSide,
    });

    const effectiveness = this.calculateEffectiveness(
      bet.amount,
      hedgeAmount,
    );

    await this.hedgeRepo.save({
      originalBetId: bet.id,
      hedgeBetId: hedgeBet.id,
      originalAmount: bet.amount,
      hedgeAmount,
      effectiveness,
    });

    return {
      originalBetId: bet.id,
      hedgeBetId: hedgeBet.id,
      effectiveness,
    };
  }

  private getOppositeSide(side: BetSide): BetSide {
    return side === BetSide.BACK ? BetSide.LAY : BetSide.BACK;
  }

  private calculateHedgeAmount(
    amount: number,
    odds: number,
  ): number {
    // Simple hedge formula (can be improved)
    return amount * (odds / (odds - 1));
  }

  private calculateEffectiveness(
    original: number,
    hedge: number,
  ): number {
    // Lower difference = better hedge
    const diff = Math.abs(original - hedge);
    return 1 - diff / original;
  }

  private async placeHedgeBet(params: {
    originalBetId: string;
    amount: number;
    side: BetSide;
  }): Promise<{ id: string }> {
    // Mock exchange call (replace with real provider)
    return {
      id: 'hedge_' + Date.now(),
    };
  }
}