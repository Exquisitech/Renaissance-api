import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { CacheConfigModule } from 'src/common/cache/cache.module';
import { OddsModule } from '../odds/odds.module';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([Match]),
    CacheConfigModule,
    OddsModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [TypeOrmModule, MatchesService],
})
export class MatchesModule {}
