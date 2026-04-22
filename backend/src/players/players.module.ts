import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { Player } from './entities/player.entity';
import { RapidapiFootballService } from './services/rapidapi-football.service';
import { DebounceService } from './services/debounce.service';

@Module({
  imports: [TypeOrmModule.forFeature([Player])],
  controllers: [PlayersController],
  providers: [PlayersService, RapidapiFootballService, DebounceService],
  exports: [PlayersService, RapidapiFootballService],
})
export class PlayersModule {}
