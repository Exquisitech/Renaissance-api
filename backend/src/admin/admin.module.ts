import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EmergencyController } from './emergency.controller';
import { EmergencyPauseService } from './emergency-pause.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminOverrideLog } from './entities/admin-override-log.entity';
import { SystemControl } from './entities/system-control.entity';
import { Bet } from '../bets/entities/bet.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FreeBetVoucher } from '../free-bet-vouchers/entities/free-bet-voucher.entity';
import { Spin } from '../spin/entities/spin.entity';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { AdminOverrideService } from './admin-override.service';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      AdminAuditLog,
      AdminOverrideLog,
      SystemControl,
      Bet,
      User,
      Match,
      Transaction,
      FreeBetVoucher,
      Spin,
    ]),
    RateLimitModule,
  ],
  controllers: [AdminController, EmergencyController],
  providers: [AdminService, AdminOverrideService, EmergencyPauseService],
  exports: [AdminService, AdminOverrideService, EmergencyPauseService],
})
export class AdminModule {}
