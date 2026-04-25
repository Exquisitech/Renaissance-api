// scoring.service.ts

import { Injectable } from '@nestjs/common';
import { MatchWeightService } from '../config/match-weight.service';
import { MatchType } from './scoring.types';

@Injectable()
export class ScoringService {
  constructor(
    private readonly weightService: MatchWeightService,
  ) {}

  async calculateScore(
    baseScore: number,
    matchType: MatchType,
  ): Promise<number> {
    const weight = await this.weightService.getWeight(matchType);

    return baseScore * weight;
  }
}