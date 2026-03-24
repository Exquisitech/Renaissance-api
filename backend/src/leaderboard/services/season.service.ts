import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Season, SeasonStatus } from '../entities/season.entity';
import { CreateSeasonDto, UpdateSeasonDto } from '../dto/season.dto';

@Injectable()
export class SeasonService {
  private readonly logger = new Logger(SeasonService.name);

  constructor(
    @InjectRepository(Season)
    private readonly seasonRepo: Repository<Season>,
  ) {}

  async createSeason(dto: CreateSeasonDto): Promise<Season> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for overlapping seasons
    const overlapping = await this.seasonRepo.findOne({
      where: [
        { startDate: LessThan(dto.endDate), endDate: MoreThan(dto.startDate) },
      ],
    });

    if (overlapping) {
      throw new BadRequestException(
        'Season dates overlap with existing season',
      );
    }

    const season = this.seasonRepo.create({
      ...dto,
      status: SeasonStatus.ACTIVE,
    });

    return this.seasonRepo.save(season);
  }

  async updateSeason(id: string, dto: UpdateSeasonDto): Promise<Season> {
    const season = await this.seasonRepo.findOne({ where: { id } });
    if (!season) {
      throw new NotFoundException('Season not found');
    }

    Object.assign(season, dto);
    return this.seasonRepo.save(season);
  }

  async getActiveSeason(): Promise<Season | null> {
    const now = new Date();
    return this.seasonRepo.findOne({
      where: {
        status: SeasonStatus.ACTIVE,
        startDate: LessThan(now),
        endDate: MoreThan(now),
      },
    });
  }

  async getAllSeasons(): Promise<Season[]> {
    return this.seasonRepo.find({
      order: { seasonNumber: 'DESC' },
    });
  }

  async getSeasonById(id: string): Promise<Season> {
    const season = await this.seasonRepo.findOne({ where: { id } });
    if (!season) {
      throw new NotFoundException('Season not found');
    }
    return season;
  }

  async completeSeason(id: string): Promise<Season> {
    const season = await this.getSeasonById(id);
    season.status = SeasonStatus.COMPLETED;
    return this.seasonRepo.save(season);
  }

  async archiveSeason(id: string): Promise<Season> {
    const season = await this.getSeasonById(id);
    season.status = SeasonStatus.ARCHIVED;
    return this.seasonRepo.save(season);
  }
}
