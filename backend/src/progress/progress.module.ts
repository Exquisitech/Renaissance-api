import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { Leaderboard } from '../leaderboard/entities/leaderboard.entity';
import { UserSpinStats } from '../spin-game/entities/user-spin-stats.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Leaderboard, UserSpinStats])],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
