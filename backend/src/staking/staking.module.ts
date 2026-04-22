import { Module } from '@nestjs/common';
import { StakingService } from './staking.service';
import { StakingController } from './staking.controller';
import { StakingContractService } from './services/staking-contract.service';
import { RewardCalculatorService } from './services/reward-calculator.service';
import { RewardDistributorService } from './services/reward-distributor.service';
import { StakingCronService } from './services/staking-cron.service';

@Module({
  providers: [
    StakingService,
    StakingContractService,
    RewardCalculatorService,
    RewardDistributorService,
    StakingCronService,
  ],
  controllers: [StakingController],
  exports: [StakingService],
})
export class StakingModule {}
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StakingService } from './staking.service';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([User, Transaction])],
  providers: [StakingService],
  exports: [StakingService],
})
export class StakingModule {}
