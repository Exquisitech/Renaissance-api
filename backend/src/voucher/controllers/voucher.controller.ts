import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';

@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.voucherService.create(dto);
  }

  @Post('redeem/:code')
  redeem(@Param('code') code: string) {
    const userId = 'mock-user-id'; // replace with auth user
    return this.voucherService.redeem(code, userId);
  }

  @Get('analytics/:id')
  analytics(@Param('id') id: string) {
    return this.voucherService.getAnalytics(id);
  }
}