import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { MatchStatus, MatchOutcome } from '../common/enums/match.enums';
import { CreateMatchDto, UpdateMatchDto, UpdateMatchStatusDto } from './dto';
import { CacheInvalidationService } from '../common/cache/cache-invalidation.service';
import { MatchFinishedEvent } from './events/match-finished.event';
import { OddsService } from '../odds/odds.service';
import { OddsUpdateSource } from '../odds/entities/match-odds-history.entity';

export interface PaginatedMatches {
  data: Match[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MatchFilters {
  status?: MatchStatus;
  league?: string;
  season?: string;
  homeTeam?: string;
  awayTeam?: string;
  startTimeFrom?: Date;
  startTimeTo?: Date;
}

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    private readonly cacheInvalidationService: CacheInvalidationService,
    private readonly eventBus: EventBus,
    private readonly oddsService: OddsService,
  ) {}

  /**
   * Create a new match
   */
  async createMatch(createMatchDto: CreateMatchDto): Promise<Match> {
    // Validate start time is not in the past
    const startTime = new Date(createMatchDto.startTime);
    if (startTime < new Date()) {
      throw new BadRequestException('Start time cannot be in the past');
    }

    // Validate team names are different
    if (createMatchDto.homeTeam === createMatchDto.awayTeam) {
      throw new BadRequestException(
        'Home team and away team must be different',
      );
    }

    const match = this.matchRepository.create({
      ...createMatchDto,
      status: createMatchDto.status || MatchStatus.UPCOMING,
    });

    return this.matchRepository.save(match);
  }

  /**
   * Get a match by ID
   */
  async getMatchById(matchId: string): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    return match;
  }

  /**
   * List matches with pagination and filtering
   */
  async getMatches(
    page: number = 1,
    limit: number = 10,
    filters?: MatchFilters,
  ): Promise<PaginatedMatches> {
    // Validate pagination parameters
    if (page < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    const queryBuilder = this.matchRepository.createQueryBuilder('match');

    // Apply filters
    if (filters) {
      if (filters.status) {
        queryBuilder.andWhere('match.status = :status', {
          status: filters.status,
        });
      }

      if (filters.league) {
        queryBuilder.andWhere('match.league = :league', {
          league: filters.league,
        });
      }

      if (filters.season) {
        queryBuilder.andWhere('match.season = :season', {
          season: filters.season,
        });
      }

      if (filters.homeTeam) {
        queryBuilder.andWhere('match.homeTeam ILIKE :homeTeam', {
          homeTeam: `%${filters.homeTeam}%`,
        });
      }

      if (filters.awayTeam) {
        queryBuilder.andWhere('match.awayTeam ILIKE :awayTeam', {
          awayTeam: `%${filters.awayTeam}%`,
        });
      }

      if (filters.startTimeFrom) {
        queryBuilder.andWhere('match.startTime >= :startTimeFrom', {
          startTimeFrom: filters.startTimeFrom,
        });
      }

      if (filters.startTimeTo) {
        queryBuilder.andWhere('match.startTime <= :startTimeTo', {
          startTimeTo: filters.startTimeTo,
        });
      }
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination and sorting
    const matches = await queryBuilder
      .orderBy('match.startTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: matches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a match
   */
  async updateMatch(
    matchId: string,
    updateMatchDto: UpdateMatchDto,
  ): Promise<Match> {
    const match = await this.getMatchById(matchId);
    const previousStatus = match.status;
    const previousOdds = this.extractOdds(match);

    // Validate status transitions
    if (updateMatchDto.status) {
      this.validateStatusTransition(match.status, updateMatchDto.status);
    }

    // If updating to finished, ensure scores are provided
    if (
      updateMatchDto.status === MatchStatus.FINISHED &&
      (updateMatchDto.homeScore === undefined ||
        updateMatchDto.awayScore === undefined)
    ) {
      if (match.homeScore === null || match.awayScore === null) {
        throw new BadRequestException(
          'Home score and away score must be provided when finishing a match',
        );
      }
    }

    // Auto-calculate outcome if scores are provided and match is finished
    if (
      (updateMatchDto.status === MatchStatus.FINISHED ||
        match.status === MatchStatus.FINISHED) &&
      (updateMatchDto.homeScore !== undefined ||
        updateMatchDto.awayScore !== undefined)
    ) {
      const homeScore = updateMatchDto.homeScore ?? match.homeScore ?? 0;
      const awayScore = updateMatchDto.awayScore ?? match.awayScore ?? 0;
      updateMatchDto.outcome = this.calculateOutcome(homeScore, awayScore);
    }

    // Validate team names if provided
    if (updateMatchDto.homeTeam && updateMatchDto.awayTeam) {
      if (updateMatchDto.homeTeam === updateMatchDto.awayTeam) {
        throw new BadRequestException(
          'Home team and away team must be different',
        );
      }
    }

    Object.assign(match, updateMatchDto);
    const savedMatch = await this.matchRepository.save(match);
    await this.cacheInvalidationService.invalidatePattern('matches*');
    await this.oddsService.handleDirectMatchOddsUpdate(savedMatch, previousOdds, {
      source: OddsUpdateSource.MATCH_UPDATE,
      reason: 'match_update',
      metadata: { trigger: 'matches.update' },
    });
    await this.publishMatchFinishedEventIfNeeded(previousStatus, savedMatch);
    return savedMatch;
  }

  /**
   * Update match status and scores (streamlined endpoint for live updates)
   */
  async updateMatchStatus(
    matchId: string,
    updateStatusDto: UpdateMatchStatusDto,
  ): Promise<Match> {
    const match = await this.getMatchById(matchId);
    const previousStatus = match.status;
    const previousOdds = this.extractOdds(match);

    // Validate status transition
    this.validateStatusTransition(match.status, updateStatusDto.status);

    // If finishing the match, ensure scores are provided
    if (updateStatusDto.status === MatchStatus.FINISHED) {
      const homeScore = updateStatusDto.homeScore ?? match.homeScore;
      const awayScore = updateStatusDto.awayScore ?? match.awayScore;

      if (homeScore === null || awayScore === null) {
        throw new BadRequestException(
          'Home score and away score must be provided when finishing a match',
        );
      }

      // Auto-calculate outcome
      updateStatusDto.outcome = this.calculateOutcome(homeScore, awayScore);
    }

    Object.assign(match, updateStatusDto);
    const savedMatch = await this.matchRepository.save(match);
    await this.cacheInvalidationService.invalidatePattern('matches*');
    await this.oddsService.handleDirectMatchOddsUpdate(savedMatch, previousOdds, {
      source: OddsUpdateSource.MATCH_UPDATE,
      reason: 'match_status_update',
      metadata: { trigger: 'matches.update_status' },
    });
    await this.publishMatchFinishedEventIfNeeded(previousStatus, savedMatch);
    return savedMatch;
  }

  /**
   * Soft delete a match (set status to cancelled)
   */
  async deleteMatch(matchId: string): Promise<{ message: string }> {
    const match = await this.getMatchById(matchId);

    // Only allow cancellation of upcoming or postponed matches
    if (
      match.status !== MatchStatus.UPCOMING &&
      match.status !== MatchStatus.POSTPONED
    ) {
      throw new BadRequestException(
        `Cannot cancel a match with status ${match.status}`,
      );
    }

    match.status = MatchStatus.CANCELLED;
    await this.matchRepository.save(match);
    await this.cacheInvalidationService.invalidatePattern('matches*');

    return {
      message: `Match ${matchId} has been cancelled`,
    };
  }

  /**
   * Get upcoming matches
   */
  async getUpcomingMatches(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMatches> {
    return this.getMatches(page, limit, {
      status: MatchStatus.UPCOMING,
      startTimeFrom: new Date(),
    });
  }

  /**
   * Get live matches
   */
  async getLiveMatches(): Promise<Match[]> {
    const result = await this.getMatches(1, 100, {
      status: MatchStatus.LIVE,
    });
    return result.data;
  }

  /**
   * Get finished matches
   */
  async getFinishedMatches(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMatches> {
    return this.getMatches(page, limit, {
      status: MatchStatus.FINISHED,
    });
  }

  /**
   * Validate status transitions
   */
  private validateStatusTransition(
    currentStatus: MatchStatus,
    newStatus: MatchStatus,
  ): void {
    const validTransitions: Record<MatchStatus, MatchStatus[]> = {
      [MatchStatus.UPCOMING]: [
        MatchStatus.LIVE,
        MatchStatus.POSTPONED,
        MatchStatus.CANCELLED,
      ],
      [MatchStatus.LIVE]: [MatchStatus.FINISHED, MatchStatus.POSTPONED],
      [MatchStatus.FINISHED]: [], // Cannot transition from finished
      [MatchStatus.POSTPONED]: [MatchStatus.UPCOMING, MatchStatus.CANCELLED],
      [MatchStatus.CANCELLED]: [], // Cannot transition from cancelled
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new ConflictException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Calculate match outcome based on scores
   */
  private calculateOutcome(homeScore: number, awayScore: number): MatchOutcome {
    if (homeScore > awayScore) {
      return MatchOutcome.HOME_WIN;
    } else if (awayScore > homeScore) {
      return MatchOutcome.AWAY_WIN;
    } else {
      return MatchOutcome.DRAW;
    }
  }

  private async publishMatchFinishedEventIfNeeded(
    previousStatus: MatchStatus,
    match: Match,
  ): Promise<void> {
    if (
      previousStatus !== MatchStatus.FINISHED &&
      match.status === MatchStatus.FINISHED &&
      match.outcome
    ) {
      this.eventBus.publish(
        new MatchFinishedEvent(match.id, match.outcome, new Date()),
      );
    }
  }

  private extractOdds(match: Match): {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
  } {
    return {
      homeOdds: Number(match.homeOdds),
      drawOdds: Number(match.drawOdds),
      awayOdds: Number(match.awayOdds),
    };
  }
}
