import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, SelectQueryBuilder } from 'typeorm';
import { Team } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { SearchTeamsDto } from './dto/search-teams.dto';
import { Match } from '../matches/entities/match.entity';
import { MatchStatus } from '../common/enums/match.enums';

export interface PaginatedTeams {
  data: Team[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TeamStandings {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(Match)
    private matchesRepository: Repository<Match>,
  ) {}

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    const team = this.teamsRepository.create(createTeamDto);
    return this.teamsRepository.save(team);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedTeams> {
    const [data, total] = await this.teamsRepository.findAndCount({
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

  async findOne(id: string): Promise<Team> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: ['homeMatches', 'awayMatches'],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async search(searchDto: SearchTeamsDto, page = 1, limit = 10): Promise<PaginatedTeams> {
    const queryBuilder = this.teamsRepository.createQueryBuilder('team');

    if (searchDto.search) {
      queryBuilder.andWhere(
        '(team.name ILIKE :search OR team.shortName ILIKE :search OR team.code ILIKE :search)',
        { search: `%${searchDto.search}%` }
      );
    }

    if (searchDto.league) {
      queryBuilder.andWhere('team.league ILIKE :league', { league: `%${searchDto.league}%` });
    }

    if (searchDto.country) {
      queryBuilder.andWhere('team.country ILIKE :country', { country: `%${searchDto.country}%` });
    }

    queryBuilder.orderBy('team.name', 'ASC');

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLeagueStandings(league: string, season?: string): Promise<TeamStandings[]> {
    const teams = await this.teamsRepository.find({
      where: { league: Like(`%${league}%`) },
      order: { name: 'ASC' },
    });

    const standings: TeamStandings[] = [];

    for (const team of teams) {
      const matchesQuery = this.matchesRepository
        .createQueryBuilder('match')
        .where('(match.homeTeam = :teamName OR match.awayTeam = :teamName)', { teamName: team.name })
        .andWhere('match.status = :status', { status: MatchStatus.FINISHED });

      if (season) {
        matchesQuery.andWhere('match.season = :season', { season });
      }

      const matches = await matchesQuery.getMany();

      let played = 0;
      let won = 0;
      let drawn = 0;
      let lost = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;

      for (const match of matches) {
        played++;
        const isHome = match.homeTeam === team.name;
        const teamScore = isHome ? match.homeScore : match.awayScore;
        const opponentScore = isHome ? match.awayScore : match.homeScore;

        goalsFor += teamScore || 0;
        goalsAgainst += opponentScore || 0;

        if (teamScore > opponentScore) {
          won++;
        } else if (teamScore === opponentScore) {
          drawn++;
        } else {
          lost++;
        }
      }

      const goalDifference = goalsFor - goalsAgainst;
      const points = won * 3 + drawn;

      standings.push({
        team,
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference,
        points,
      });
    }

    return standings.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.goalDifference !== a.goalDifference) {
        return b.goalDifference - a.goalDifference;
      }
      return b.goalsFor - a.goalsFor;
    });
  }

  async update(id: string, updateTeamDto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);
    Object.assign(team, updateTeamDto);
    return this.teamsRepository.save(team);
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.teamsRepository.remove(team);
  }
}
