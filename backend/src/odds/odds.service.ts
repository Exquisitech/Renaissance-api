import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { Bet, BetStatus } from '../bets/entities/bet.entity';
import { CacheInvalidationService } from '../common/cache/cache-invalidation.service';
import { Match, MatchOutcome, MatchStatus } from '../matches/entities/match.entity';
import { UpdateMatchOddsDto } from './dto/update-match-odds.dto';
import {
  MatchOddsHistory,
  OddsUpdateSource,
} from './entities/match-odds-history.entity';
import { OddsRealtimeService } from './odds-realtime.service';

interface OddsValues {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}

interface OddsUpdateOptions {
  source: OddsUpdateSource;
  changedByUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class OddsService {
  private readonly logger = new Logger(OddsService.name);

  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Bet)
    private readonly betRepository: Repository<Bet>,
    @InjectRepository(MatchOddsHistory)
    private readonly oddsHistoryRepository: Repository<MatchOddsHistory>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly cacheInvalidationService: CacheInvalidationService,
    private readonly oddsRealtimeService: OddsRealtimeService,
  ) {}

  async getOddsSnapshot(matchId: string): Promise<Record<string, unknown>> {
    const cacheKey = this.getCacheKey(matchId);
    const cached = await this.cacheManager.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const match = await this.findMatch(matchId);
    const snapshot = this.buildSnapshot(match);
    await this.cacheManager.set(cacheKey, snapshot, 60);
    return snapshot;
  }

  async getOddsHistory(matchId: string, limit: number = 50): Promise<MatchOddsHistory[]> {
    return this.oddsHistoryRepository.find({
      where: { matchId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async updateOdds(
    matchId: string,
    dto: UpdateMatchOddsDto,
    options: OddsUpdateOptions,
  ): Promise<Record<string, unknown>> {
    const match = await this.findMatch(matchId);
    const previousOdds = this.extractOdds(match);
    const nextOdds = this.normalizeOdds(dto);

    if (!this.hasOddsChanged(previousOdds, nextOdds)) {
      return this.getOddsSnapshot(matchId);
    }

    match.homeOdds = nextOdds.homeOdds;
    match.drawOdds = nextOdds.drawOdds;
    match.awayOdds = nextOdds.awayOdds;
    const savedMatch = await this.matchRepository.save(match);

    return this.recordOddsChange(savedMatch, previousOdds, nextOdds, options);
  }

  async handleDirectMatchOddsUpdate(
    match: Match,
    previousOdds: OddsValues,
    options: OddsUpdateOptions,
  ): Promise<void> {
    const nextOdds = this.extractOdds(match);
    if (!this.hasOddsChanged(previousOdds, nextOdds)) {
      return;
    }

    await this.recordOddsChange(match, previousOdds, nextOdds, options);
  }

  async autoAdjustOdds(
    matchId: string,
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const match = await this.findMatch(matchId);

    if (
      match.status === MatchStatus.FINISHED ||
      match.status === MatchStatus.CANCELLED
    ) {
      return this.getOddsSnapshot(matchId);
    }

    const previousOdds = this.extractOdds(match);
    const nextOdds = await this.calculateAutomaticOdds(match);

    if (!this.hasOddsChanged(previousOdds, nextOdds)) {
      return this.getOddsSnapshot(matchId);
    }

    match.homeOdds = nextOdds.homeOdds;
    match.drawOdds = nextOdds.drawOdds;
    match.awayOdds = nextOdds.awayOdds;
    const savedMatch = await this.matchRepository.save(match);

    return this.recordOddsChange(savedMatch, previousOdds, nextOdds, {
      source: OddsUpdateSource.AUTOMATIC,
      reason:
        match.status === MatchStatus.LIVE
          ? 'automatic_live_reprice'
          : 'automatic_market_reprice',
      metadata,
    });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async refreshLiveMatchOdds(): Promise<void> {
    const liveMatches = await this.matchRepository.find({
      where: { status: MatchStatus.LIVE },
      order: { startTime: 'ASC' },
      take: 25,
    });

    for (const match of liveMatches) {
      try {
        await this.autoAdjustOdds(match.id, { trigger: 'live_scheduler' });
      } catch (error) {
        this.logger.warn(
          `Failed to refresh live odds for match ${match.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshUpcomingMatchOdds(): Promise<void> {
    const upcomingMatches = await this.matchRepository
      .createQueryBuilder('match')
      .where('match.status = :status', { status: MatchStatus.UPCOMING })
      .andWhere('match.startTime >= :now', { now: new Date() })
      .orderBy('match.startTime', 'ASC')
      .take(25)
      .getMany();

    for (const match of upcomingMatches) {
      try {
        await this.autoAdjustOdds(match.id, { trigger: 'upcoming_scheduler' });
      } catch (error) {
        this.logger.warn(
          `Failed to refresh upcoming odds for match ${match.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  private async calculateAutomaticOdds(match: Match): Promise<OddsValues> {
    const currentOdds = this.extractOdds(match);
    const baseProbabilities = this.normalizeProbabilities({
      home: 1 / Number(currentOdds.homeOdds),
      draw: 1 / Number(currentOdds.drawOdds),
      away: 1 / Number(currentOdds.awayOdds),
    });

    const rawVolumes = await this.betRepository
      .createQueryBuilder('bet')
      .select('bet.predictedOutcome', 'predictedOutcome')
      .addSelect('COALESCE(SUM(bet.stake_amount), 0)', 'stakeAmount')
      .where('bet.matchId = :matchId', { matchId: match.id })
      .andWhere('bet.status = :status', { status: BetStatus.PENDING })
      .groupBy('bet.predictedOutcome')
      .getRawMany<{ predictedOutcome: MatchOutcome; stakeAmount: string }>();

    const totalVolume = rawVolumes.reduce(
      (sum, item) => sum + Number(item.stakeAmount || 0),
      0,
    );

    const volumeProbabilities =
      totalVolume > 0
        ? this.normalizeProbabilities({
            home: this.readStakeShare(rawVolumes, MatchOutcome.HOME_WIN),
            draw: this.readStakeShare(rawVolumes, MatchOutcome.DRAW),
            away: this.readStakeShare(rawVolumes, MatchOutcome.AWAY_WIN),
          })
        : baseProbabilities;

    const scoreProbabilities = this.buildScoreWeightedProbabilities(
      match,
      baseProbabilities,
    );

    const weights =
      match.status === MatchStatus.LIVE
        ? { base: 0.45, volume: 0.2, score: 0.35 }
        : { base: 0.65, volume: 0.35, score: 0 };

    const combined = this.normalizeProbabilities({
      home:
        baseProbabilities.home * weights.base +
        volumeProbabilities.home * weights.volume +
        scoreProbabilities.home * weights.score,
      draw:
        baseProbabilities.draw * weights.base +
        volumeProbabilities.draw * weights.volume +
        scoreProbabilities.draw * weights.score,
      away:
        baseProbabilities.away * weights.base +
        volumeProbabilities.away * weights.volume +
        scoreProbabilities.away * weights.score,
    });

    const overround = 1.06;
    return {
      homeOdds: this.clampOdds(overround / combined.home),
      drawOdds: this.clampOdds(overround / combined.draw),
      awayOdds: this.clampOdds(overround / combined.away),
    };
  }

  private buildScoreWeightedProbabilities(
    match: Match,
    baseProbabilities: { home: number; draw: number; away: number },
  ): { home: number; draw: number; away: number } {
    if (
      match.status !== MatchStatus.LIVE ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      return baseProbabilities;
    }

    const modifiers = { home: 1, draw: 1, away: 1 };
    const goalDifference = Number(match.homeScore) - Number(match.awayScore);

    if (goalDifference > 0) {
      modifiers.home += Math.min(goalDifference * 0.18, 0.54);
      modifiers.draw = Math.max(0.5, modifiers.draw - goalDifference * 0.06);
      modifiers.away = Math.max(0.35, modifiers.away - goalDifference * 0.12);
    } else if (goalDifference < 0) {
      const absoluteDifference = Math.abs(goalDifference);
      modifiers.away += Math.min(absoluteDifference * 0.18, 0.54);
      modifiers.draw = Math.max(
        0.5,
        modifiers.draw - absoluteDifference * 0.06,
      );
      modifiers.home = Math.max(
        0.35,
        modifiers.home - absoluteDifference * 0.12,
      );
    }

    return this.normalizeProbabilities({
      home: baseProbabilities.home * modifiers.home,
      draw: baseProbabilities.draw * modifiers.draw,
      away: baseProbabilities.away * modifiers.away,
    });
  }

  private readStakeShare(
    rawVolumes: Array<{ predictedOutcome: MatchOutcome; stakeAmount: string }>,
    outcome: MatchOutcome,
  ): number {
    const match = rawVolumes.find((item) => item.predictedOutcome === outcome);
    return Number(match?.stakeAmount || 0);
  }

  private async recordOddsChange(
    match: Match,
    previousOdds: OddsValues,
    nextOdds: OddsValues,
    options: OddsUpdateOptions,
  ): Promise<Record<string, unknown>> {
    const history = this.oddsHistoryRepository.create({
      matchId: match.id,
      previousHomeOdds: previousOdds.homeOdds,
      previousDrawOdds: previousOdds.drawOdds,
      previousAwayOdds: previousOdds.awayOdds,
      newHomeOdds: nextOdds.homeOdds,
      newDrawOdds: nextOdds.drawOdds,
      newAwayOdds: nextOdds.awayOdds,
      source: options.source,
      changedByUserId: options.changedByUserId ?? null,
      reason: options.reason ?? null,
      metadata: options.metadata ?? null,
    });
    await this.oddsHistoryRepository.save(history);

    const snapshot = this.buildSnapshot(match);
    await this.cacheManager.set(this.getCacheKey(match.id), snapshot, 60);
    await this.cacheInvalidationService.invalidatePattern('matches*');

    this.oddsRealtimeService.broadcast({
      type: 'odds.updated',
      websocketPath: this.oddsRealtimeService.getWebSocketPath(),
      matchId: match.id,
      source: options.source,
      reason: options.reason ?? null,
      changedAt: new Date().toISOString(),
      odds: snapshot,
    });

    return snapshot;
  }

  private buildSnapshot(match: Match): Record<string, unknown> {
    return {
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      status: match.status,
      homeOdds: Number(match.homeOdds),
      drawOdds: Number(match.drawOdds),
      awayOdds: Number(match.awayOdds),
      updatedAt: match.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private extractOdds(match: Match): OddsValues {
    return {
      homeOdds: Number(match.homeOdds),
      drawOdds: Number(match.drawOdds),
      awayOdds: Number(match.awayOdds),
    };
  }

  private normalizeOdds(dto: UpdateMatchOddsDto): OddsValues {
    return {
      homeOdds: this.clampOdds(dto.homeOdds),
      drawOdds: this.clampOdds(dto.drawOdds),
      awayOdds: this.clampOdds(dto.awayOdds),
    };
  }

  private hasOddsChanged(previous: OddsValues, next: OddsValues): boolean {
    return (
      Math.abs(previous.homeOdds - next.homeOdds) >= 0.01 ||
      Math.abs(previous.drawOdds - next.drawOdds) >= 0.01 ||
      Math.abs(previous.awayOdds - next.awayOdds) >= 0.01
    );
  }

  private normalizeProbabilities(probabilities: {
    home: number;
    draw: number;
    away: number;
  }): { home: number; draw: number; away: number } {
    const sanitized = {
      home: Math.max(probabilities.home, 0.0001),
      draw: Math.max(probabilities.draw, 0.0001),
      away: Math.max(probabilities.away, 0.0001),
    };
    const total = sanitized.home + sanitized.draw + sanitized.away;

    return {
      home: sanitized.home / total,
      draw: sanitized.draw / total,
      away: sanitized.away / total,
    };
  }

  private clampOdds(value: number): number {
    const bounded = Math.min(Math.max(value, 1.05), 25);
    return Number(bounded.toFixed(2));
  }

  private getCacheKey(matchId: string): string {
    return `odds:match:${matchId}`;
  }

  private async findMatch(matchId: string): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    return match;
  }
}
