import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { StakingService } from './staking.service';
import { StakingController } from './staking.controller';
import { WalletModule } from '../wallet/wallet.module';
import { Stake } from './entities/stake.entity';
import { StakeDelegation } from './entities/stake-delegation.entity';
import { StakingTier } from './entities/staking-tier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stake, StakeDelegation, StakingTier]),
    ScheduleModule.forRoot(),
    WalletModule,
  ],
  providers: [StakingService],
  controllers: [StakingController],
  exports: [StakingService],
})
export class StakingModule {}
