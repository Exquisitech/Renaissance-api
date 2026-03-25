import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Voucher, VoucherStatus } from './entities/voucher.entity';
import { VoucherRedemption } from './entities/voucher-redemption.entity';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class VoucherService {
  constructor(
    @InjectRepository(Voucher)
    private voucherRepo: Repository<Voucher>,

    @InjectRepository(VoucherRedemption)
    private redemptionRepo: Repository<VoucherRedemption>,
  ) {}

  // ✅ Generate voucher code
  generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase(); // e.g. A1B2C3D4
  }

  // ✅ Create voucher (Campaign support)
  async create(dto: CreateVoucherDto) {
    const voucher = this.voucherRepo.create({
      ...dto,
      code: this.generateCode(),
    });

    return this.voucherRepo.save(voucher);
  }

  // ✅ Redeem voucher
  async redeem(code: string, userId: string) {
    const voucher = await this.voucherRepo.findOne({ where: { code } });

    if (!voucher) throw new BadRequestException('Invalid voucher');

    if (voucher.status !== VoucherStatus.ACTIVE) {
      throw new BadRequestException('Voucher not active');
    }

    if (new Date() > voucher.expiryDate) {
      throw new BadRequestException('Voucher expired');
    }

    // Global usage limit
    if (
      voucher.maxGlobalUsage &&
      voucher.totalRedemptions >= voucher.maxGlobalUsage
    ) {
      throw new BadRequestException('Voucher usage limit reached');
    }

    let redemption = await this.redemptionRepo.findOne({
      where: { userId, voucherId: voucher.id },
    });

    if (redemption) {
      if (redemption.usageCount >= voucher.usageLimitPerUser) {
        throw new BadRequestException('User usage limit exceeded');
      }

      redemption.usageCount += 1;
    } else {
      redemption = this.redemptionRepo.create({
        userId,
        voucherId: voucher.id,
        usageCount: 1,
      });
    }

    voucher.totalRedemptions += 1;

    await this.redemptionRepo.save(redemption);
    await this.voucherRepo.save(voucher);

    return {
      message: 'Voucher redeemed successfully',
      amount: voucher.amount,
    };
  }

  // ✅ Analytics
  async getAnalytics(voucherId: string) {
    const totalUsers = await this.redemptionRepo.count({
      where: { voucherId },
    });

    const totalRedemptions = await this.redemptionRepo
      .createQueryBuilder('r')
      .select('SUM(r.usageCount)', 'sum')
      .where('r.voucherId = :voucherId', { voucherId })
      .getRawOne();

    return {
      totalUsers,
      totalRedemptions: Number(totalRedemptions.sum || 0),
    };
  }

  // ✅ Expire vouchers automatically
  async expireVouchers() {
    await this.voucherRepo.update(
      {
        expiryDate: LessThan(new Date()),
        status: VoucherStatus.ACTIVE,
      },
      {
        status: VoucherStatus.EXPIRED,
      },
    );
  }

  async createVoucher(dto: CreateVoucherDto, campaignId?: string) {
  const voucher = this.voucherRepo.create({
    ...dto,
    code: this.generateCode(),
    campaign: campaignId ? { id: campaignId } : null,
  });

  return this.voucherRepo.save(voucher);
}

// 🔥 Bulk generation (for promotions)
async generateBulk(count: number, dto: CreateVoucherDto) {
  const vouchers = [];

  for (let i = 0; i < count; i++) {
    vouchers.push(
      this.voucherRepo.create({
        ...dto,
        code: this.generateCode(),
      }),
    );
  }

  return this.voucherRepo.save(vouchers);
}
}