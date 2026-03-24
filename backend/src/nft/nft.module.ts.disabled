import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFTController } from './nft.controller';
import { NFTService } from './nft.service';
import { NFTPlayerCard } from './nft.entity';
import { User } from 'src/users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { StellarModule } from '../stellar/stellar.module';
import { SorobanModule } from '../soroban/soroban.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    TypeOrmModule.forFeature([NFTPlayerCard, User]),
    forwardRef(() => UsersModule),
    StellarModule,
    SorobanModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [NFTController],
  providers: [NFTService, RewardListenerService],
  exports: [NFTService],
})
export class NFTModule {}