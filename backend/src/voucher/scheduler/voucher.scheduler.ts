import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VoucherService } from './voucher.service';

@Injectable()
export class VoucherScheduler {
  constructor(private voucherService: VoucherService) {}

  // Runs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleVoucherExpiry() {
    await this.voucherService.expireVouchers();
    console.log('Expired vouchers checked');
  }
}