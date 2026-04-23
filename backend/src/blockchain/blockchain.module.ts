import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SorobanService } from './soroban.service';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { Settlement } from './entities/settlement.entity';
import { StellarService } from './stellar.service';
import { StellarController } from './stellar.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Settlement])],
  controllers: [SettlementController, StellarController],
  providers: [SorobanService, SettlementService, StellarService],
  exports: [SettlementService, SorobanService, StellarService],
})
export class BlockchainModule {}
