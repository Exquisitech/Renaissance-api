import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationEventHandlers } from './handlers/gamification-event.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Achievement, UserAchievement]),
    CqrsModule,
  ],
  controllers: [GamificationController],
  providers: [GamificationService, ...GamificationEventHandlers],
  exports: [GamificationService],
})
export class GamificationModule {}
