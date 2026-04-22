import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JackpotService } from './jackpot.service';
import { JackpotController } from './jackpot.controller';
import {
  SpinJackpot,
  SpinJackpotWinner,
  SpinJackpotContribution,
  SpinJackpotStats,
} from './entities/jackpot.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpinJackpot,
      SpinJackpotWinner,
      SpinJackpotContribution,
      SpinJackpotStats,
    ]),
    NotificationsModule,
  ],
  controllers: [JackpotController],
  providers: [JackpotService],
  exports: [JackpotService],
})
export class JackpotModule {}