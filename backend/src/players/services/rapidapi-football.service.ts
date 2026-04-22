import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PlayerSearchResult {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  age: number;
  birth: {
    date: string;
    place: string;
    country: string;
  };
  nationality: string;
  height: string;
  weight: string;
  injured: boolean;
  photo: string;
}

export interface PlayerStatistics {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
  };
  games: {
    appearences: number;
    lineups: number;
    minutes: number;
    number: number;
    position: string;
    rating: string;
    captain: boolean;
  };
  substitutes: {
    in: number;
    out: number;
    bench: number;
  };
  shots: {
    total: number;
    on: number;
  };
  goals: {
    total: number;
    conceded: number;
    assists: number;
    saves: number;
  };
  passes: {
    total: number;
    key: number;
    accuracy: string;
  };
  tackles: {
    total: number;
    blocks: number;
    interceptions: number;
  };
  duels: {
    total: number;
    won: number;
  };
  dribbles: {
    attempts: number;
    success: number;
    past: number;
  };
  fouls: {
    drawn: number;
    committed: number;
  };
  cards: {
    yellow: number;
    yellowred: number;
    red: number;
  };
  penalty: {
    won: number;
    commited: number;
    scored: number;
    missed: number;
    saved: number;
  };
}

export interface PlayerTeamInfo {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  league: string;
  season: number;
  position: string;
  number: number;
}

@Injectable()
export class RapidapiFootballService {
  private readonly logger = new Logger(RapidapiFootballService.name);
  private readonly api: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RAPIDAPI_FOOTBALL_KEY');
    const apiHost = this.configService.get<string>('RAPIDAPI_FOOTBALL_HOST', 'v3.football.api-sports.io');

    if (!apiKey) {
      this.logger.warn('RapidAPI Football API key not configured. Some features may not work.');
    }

    this.api = axios.create({
      baseURL: `https://${apiHost}`,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
      timeout: 10000,
    });
  }

  async searchPlayers(query: string, league?: number, season?: number): Promise<PlayerSearchResult[]> {
    try {
      const params: any = { search: query };
      if (league) params.league = league;
      if (season) params.season = season;

      const response = await this.api.get('/v3/players', { params });
      return response.data.response || [];
    } catch (error) {
      this.logger.error(`Error searching players: ${error.message}`, error.stack);
      return [];
    }
  }

  async getPlayerStatistics(playerId: number, league?: number, season?: number): Promise<PlayerStatistics[]> {
    try {
      const params: any = {};
      if (league) params.league = league;
      if (season) params.season = season;

      const response = await this.api.get(`/v3/players/statistics`, {
        params: { id: playerId, ...params },
      });
      return response.data.response || [];
    } catch (error) {
      this.logger.error(`Error getting player statistics: ${error.message}`, error.stack);
      return [];
    }
  }

  async getPlayerTeamInfo(playerId: number): Promise<PlayerTeamInfo[]> {
    try {
      const response = await this.api.get(`/v3/players/squads`, {
        params: { player: playerId },
      });
      return response.data.response || [];
    } catch (error) {
      this.logger.error(`Error getting player team info: ${error.message}`, error.stack);
      return [];
    }
  }

  async getPlayerById(playerId: number): Promise<PlayerSearchResult | null> {
    try {
      const response = await this.api.get(`/v3/players`, {
        params: { id: playerId },
      });
      const players = response.data.response || [];
      return players.length > 0 ? players[0] : null;
    } catch (error) {
      this.logger.error(`Error getting player by ID: ${error.message}`, error.stack);
      return null;
    }
  }

  async getLeagues(): Promise<any[]> {
    try {
      const response = await this.api.get('/v3/leagues');
      return response.data.response || [];
    } catch (error) {
      this.logger.error(`Error getting leagues: ${error.message}`, error.stack);
      return [];
    }
  }

  async getTeamsByLeague(leagueId: number, season: number): Promise<any[]> {
    try {
      const response = await this.api.get('/v3/teams', {
        params: { league: leagueId, season },
      });
      return response.data.response || [];
    } catch (error) {
      this.logger.error(`Error getting teams by league: ${error.message}`, error.stack);
      return [];
    }
  }

  createFallbackPlayer(name: string): PlayerSearchResult {
    return {
      id: 0,
      name,
      firstname: '',
      lastname: '',
      age: 0,
      birth: {
        date: '',
        place: 'Unknown',
        country: 'Unknown',
      },
      nationality: 'Unknown',
      height: 'Unknown',
      weight: 'Unknown',
      injured: false,
      photo: '',
    };
  }

  createFallbackStatistics(): PlayerStatistics {
    return {
      team: { id: 0, name: 'Unknown', logo: '' },
      league: { id: 0, name: 'Unknown', country: 'Unknown', logo: '', flag: '', season: new Date().getFullYear() },
      games: { appearences: 0, lineups: 0, minutes: 0, number: 0, position: 'Unknown', rating: '0.0', captain: false },
      substitutes: { in: 0, out: 0, bench: 0 },
      shots: { total: 0, on: 0 },
      goals: { total: 0, conceded: 0, assists: 0, saves: 0 },
      passes: { total: 0, key: 0, accuracy: '0%' },
      tackles: { total: 0, blocks: 0, interceptions: 0 },
      duels: { total: 0, won: 0 },
      dribbles: { attempts: 0, success: 0, past: 0 },
      fouls: { drawn: 0, committed: 0 },
      cards: { yellow: 0, yellowred: 0, red: 0 },
      penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: 0 },
    };
  }

  isConfigured(): boolean {
    return !!this.configService.get<string>('RAPIDAPI_FOOTBALL_KEY');
  }
}
