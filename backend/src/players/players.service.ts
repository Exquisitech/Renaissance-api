import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Player } from './entities/player.entity';
import { RapidapiFootballService, PlayerSearchResult, PlayerStatistics, PlayerTeamInfo } from './services/rapidapi-football.service';
import { SearchPlayerDto } from './dto/search-player.dto';
import { PlayerStatisticsDto } from './dto/player-statistics.dto';
import { DebounceService } from './services/debounce.service';

export interface PaginatedPlayers {
  data: Player[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PlayerWithStats extends Omit<Player, 'statistics'> {
  statistics?: PlayerStatistics[];
  teamInfo?: PlayerTeamInfo[];
}

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);
  private readonly searchCache = new Map<string, any>();
  private readonly debouncedSearch: any;

  constructor(
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    private rapidapiService: RapidapiFootballService,
    private debounceService: DebounceService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.debouncedSearch = this.debounceService.create(
      this.performSearch.bind(this),
      300
    );
  }

  async searchPlayers(searchDto: SearchPlayerDto): Promise<PlayerSearchResult[]> {
    const cacheKey = `player_search_${searchDto.query}_${searchDto.league}_${searchDto.season}`;
    
    try {
      const cached = await this.cacheManager.get<PlayerSearchResult[]>(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached;
      }

      if (!this.rapidapiService.isConfigured()) {
        this.logger.warn('RapidAPI not configured, returning fallback data');
        return [this.rapidapiService.createFallbackPlayer(searchDto.query)];
      }

      const results = await this.rapidapiService.searchPlayers(
        searchDto.query,
        searchDto.league,
        searchDto.season
      );

      const limitedResults = results.slice(0, searchDto.limit || 10);

      await this.cacheManager.set(cacheKey, limitedResults, 300);
      await this.cachePopularSearch(searchDto.query, limitedResults);

      return limitedResults;
    } catch (error) {
      this.logger.error(`Error searching players: ${error.message}`, error.stack);
      return [this.rapidapiService.createFallbackPlayer(searchDto.query)];
    }
  }

  private async performSearch(query: string, league?: number, season?: number): Promise<PlayerSearchResult[]> {
    return this.searchPlayers({ query, league, season, limit: 10 });
  }

  private async cachePopularSearch(query: string, results: PlayerSearchResult[]): Promise<void> {
    const popularKey = `popular_players_${query.toLowerCase()}`;
    await this.cacheManager.set(popularKey, results, 3600);
  }

  async getPopularPlayers(query: string): Promise<PlayerSearchResult[]> {
    const popularKey = `popular_players_${query.toLowerCase()}`;
    return this.cacheManager.get<PlayerSearchResult[]>(popularKey) || [];
  }

  async getPlayerStatistics(statsDto: PlayerStatisticsDto): Promise<PlayerStatistics[]> {
    const cacheKey = `player_stats_${statsDto.playerId}_${statsDto.league}_${statsDto.season}`;
    
    try {
      const cached = await this.cacheManager.get<PlayerStatistics[]>(cacheKey);
      if (cached) {
        return cached;
      }

      if (!this.rapidapiService.isConfigured()) {
        return [this.rapidapiService.createFallbackStatistics()];
      }

      const statistics = await this.rapidapiService.getPlayerStatistics(
        statsDto.playerId,
        statsDto.league,
        statsDto.season
      );

      await this.cacheManager.set(cacheKey, statistics, 600);
      return statistics;
    } catch (error) {
      this.logger.error(`Error getting player statistics: ${error.message}`, error.stack);
      return [this.rapidapiService.createFallbackStatistics()];
    }
  }

  async getPlayerTeamInfo(playerId: number): Promise<PlayerTeamInfo[]> {
    const cacheKey = `player_team_${playerId}`;
    
    try {
      const cached = await this.cacheManager.get<PlayerTeamInfo[]>(cacheKey);
      if (cached) {
        return cached;
      }

      if (!this.rapidapiService.isConfigured()) {
        return [];
      }

      const teamInfo = await this.rapidapiService.getPlayerTeamInfo(playerId);
      await this.cacheManager.set(cacheKey, teamInfo, 1800);
      return teamInfo;
    } catch (error) {
      this.logger.error(`Error getting player team info: ${error.message}`, error.stack);
      return [];
    }
  }

  async getPlayerById(playerId: number): Promise<PlayerSearchResult | null> {
    const cacheKey = `player_${playerId}`;
    
    try {
      const cached = await this.cacheManager.get<PlayerSearchResult>(cacheKey);
      if (cached) {
        return cached;
      }

      if (!this.rapidapiService.isConfigured()) {
        return null;
      }

      const player = await this.rapidapiService.getPlayerById(playerId);
      if (player) {
        await this.cacheManager.set(cacheKey, player, 3600);
      }
      return player;
    } catch (error) {
      this.logger.error(`Error getting player by ID: ${error.message}`, error.stack);
      return null;
    }
  }

  async getPlayerAgeAndNationality(playerId: number): Promise<{
    age: number;
    nationality: string;
    birthDate: string;
    birthPlace: string;
  } | null> {
    const player = await this.getPlayerById(playerId);
    if (!player) {
      return null;
    }

    return {
      age: player.age,
      nationality: player.nationality,
      birthDate: player.birth.date,
      birthPlace: player.birth.place,
    };
  }

  async getPlayerImage(playerId: number): Promise<string> {
    const player = await this.getPlayerById(playerId);
    if (!player || !player.photo) {
      return 'https://via.placeholder.com/150x150?text=No+Image';
    }
    return player.photo;
  }

  async createPlayer(playerData: Partial<Player>): Promise<Player> {
    const player = this.playersRepository.create(playerData);
    return this.playersRepository.save(player);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedPlayers> {
    const [data, total] = await this.playersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Player> {
    const player = await this.playersRepository.findOne({ where: { id } });
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return player;
  }

  async update(id: string, updateData: Partial<Player>): Promise<Player> {
    const player = await this.findOne(id);
    Object.assign(player, updateData);
    return this.playersRepository.save(player);
  }

  async remove(id: string): Promise<void> {
    const player = await this.findOne(id);
    await this.playersRepository.remove(player);
  }

  async syncPlayerFromApi(playerId: number): Promise<Player | null> {
    try {
      const apiPlayer = await this.rapidapiService.getPlayerById(playerId);
      if (!apiPlayer) {
        return null;
      }

      const existingPlayer = await this.playersRepository.findOne({
        where: { externalId: playerId.toString() },
      });

      const playerData = {
        externalId: playerId.toString(),
        name: apiPlayer.name,
        firstName: apiPlayer.firstname,
        lastName: apiPlayer.lastname,
        age: apiPlayer.age,
        nationality: apiPlayer.nationality,
        birthDate: apiPlayer.birth.date ? new Date(apiPlayer.birth.date) : undefined,
        height: apiPlayer.height,
        weight: apiPlayer.weight,
        photoUrl: apiPlayer.photo,
        isActive: !apiPlayer.injured,
        lastUpdated: new Date(),
      };

      if (existingPlayer) {
        Object.assign(existingPlayer, playerData);
        return this.playersRepository.save(existingPlayer);
      } else {
        return this.createPlayer(playerData);
      }
    } catch (error) {
      this.logger.error(`Error syncing player from API: ${error.message}`, error.stack);
      return null;
    }
  }
}
