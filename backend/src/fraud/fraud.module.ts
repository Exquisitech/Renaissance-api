import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudService } from './fraud.service';
import { FraudController } from './fraud.controller';
import { FraudEntity } from './entities/fraud.entity';
import { User } from '../users/entities/user.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FraudEntity, User, Bet, Transaction]),
  ],
  providers: [FraudService],
  controllers: [FraudController],
  exports: [FraudService],
})
export class FraudModule {}
