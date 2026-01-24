import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { LeaderboardType } from './leaderboard-type.enum';

@Injectable()
export class LeaderboardQueryService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getLeaderboard(
    type: LeaderboardType,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.status = :status', { status: UserStatus.ACTIVE })
      .skip(skip)
      .take(limit);

    switch (type) {
      case LeaderboardType.STAKERS:
        qb
          .leftJoin('user.bets', 'bet')
          .addSelect('COALESCE(SUM(bet.amount), 0)', 'score')
          .groupBy('user.id')
          .orderBy('score', 'DESC');
        break;

      case LeaderboardType.EARNERS:
        qb
          .leftJoin('user.transactions', 'tx')
          .addSelect('COALESCE(SUM(tx.amount), 0)', 'score')
          .groupBy('user.id')
          .orderBy('score', 'DESC');
        break;

      case LeaderboardType.PREDICTORS:
        qb
          .leftJoin('user.predictions', 'prediction')
          .addSelect(
            'COUNT(CASE WHEN prediction.isCorrect = true THEN 1 END)',
            'score',
          )
          .groupBy('user.id')
          .orderBy('score', 'DESC');
        break;

      case LeaderboardType.STREAKS:
        qb
          .leftJoin('user.predictions', 'prediction')
          .addSelect('MAX(prediction.streak)', 'score')
          .groupBy('user.id')
          .orderBy('score', 'DESC');
        break;
    }

    const result = await qb.getRawAndEntities();

    return result.entities.map((user, index) => ({
      rank: skip + index + 1,
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      score: Number(result.raw[index].score),
    }));
  }
}
