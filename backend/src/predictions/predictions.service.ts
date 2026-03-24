import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prediction, PredictionStatus } from './entities/prediction.entity';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { Match, MatchStatus } from '../matches/entities/match.entity';

@Injectable()
export class PredictionsService {
  constructor(
    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  async create(
    userId: string,
    createPredictionDto: CreatePredictionDto,
  ): Promise<Prediction> {
    const { matchId, predictedOutcome } = createPredictionDto;

    // 1. Check if match exists
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    // 2. Validate match hasn't started yet
    const now = new Date();
    if (new Date(match.startTime) <= now) {
      throw new BadRequestException(
        'Cannot predict outcome for a match that has already started',
      );
    }

    // 3. Check for existing prediction (Duplicate prevention at service level)
    const existing = await this.predictionRepository.findOne({
      where: { userId, matchId },
    });
    if (existing) {
      throw new ConflictException(
        'You have already made a prediction for this match',
      );
    }

    // 4. Create and save prediction
    const prediction = this.predictionRepository.create({
      userId,
      matchId,
      predictedOutcome,
      status: PredictionStatus.PENDING,
    });

    try {
      return await this.predictionRepository.save(prediction);
    } catch (error) {
      // Handle potential race conditions that hit the DB unique constraint
      if (error.code === '23505') {
        // Postgres unique_violation code
        throw new ConflictException(
          'You have already made a prediction for this match',
        );
      }
      throw error;
    }
  }

  async findAllByUser(userId: string): Promise<Prediction[]> {
    return this.predictionRepository.find({
      where: { userId },
      relations: ['match'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Prediction> {
    const prediction = await this.predictionRepository.findOne({
      where: { id, userId },
      relations: ['match'],
    });
    if (!prediction) {
      throw new NotFoundException(`Prediction with ID ${id} not found`);
    }
    return prediction;
  }
}
