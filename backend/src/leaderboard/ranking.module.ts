import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankingService } from './services/ranking.service';
import { RankingController } from './controllers/ranking.controller';
import { Leaderboard } from './entities/leaderboard.entity';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Leaderboard, User, Bet])],
  controllers: [RankingController],
  providers: [RankingService],
  exports: [RankingService],
})
export class RankingModule {}
