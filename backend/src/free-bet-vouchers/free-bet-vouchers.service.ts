import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { FreeBetVoucher } from './entities/free-bet-voucher.entity';
import { CreateFreeBetVoucherDto } from './dto/create-free-bet-voucher.dto';
import { UpdateFreeBetVoucherDto } from './dto/update-free-bet-voucher.dto';
import { User } from '../users/entities/user.entity';

export interface PaginatedVouchers {
  data: FreeBetVoucher[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class FreeBetVoucherService {
  constructor(
    @InjectRepository(FreeBetVoucher)
    private readonly voucherRepository: Repository<FreeBetVoucher>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a free bet voucher for a user.
   * Works independently of spin and can carry optional source metadata.
   */
  async createVoucher(
    createVoucherDto: CreateFreeBetVoucherDto,
  ): Promise<FreeBetVoucher> {
    return this.createVoucherWithManager(
      this.dataSource.manager,
      createVoucherDto,
    );
  }

  async createVoucherWithManager(
    manager: EntityManager,
    createVoucherDto: CreateFreeBetVoucherDto,
  ): Promise<FreeBetVoucher> {
    const user = await manager.findOne(User, {
      where: { id: createVoucherDto.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const voucherRepo = manager.getRepository(FreeBetVoucher);
    const expiresAt = new Date(createVoucherDto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }
    if (createVoucherDto.amount <= 0) {
      throw new BadRequestException('Voucher amount must be positive');
    }

    if (createVoucherDto.maxActiveVouchersPerUser) {
      const activeCount = await voucherRepo
        .createQueryBuilder('v')
        .where('v.userId = :userId', { userId: createVoucherDto.userId })
        .andWhere('v.used = :used', { used: false })
        .andWhere('v.expiresAt > :now', { now: new Date() })
        .getCount();

      if (activeCount >= createVoucherDto.maxActiveVouchersPerUser) {
        throw new ConflictException(
          `User already has the maximum number of active vouchers (${createVoucherDto.maxActiveVouchersPerUser})`,
        );
      }
    }

    const voucher = voucherRepo.create({
      userId: createVoucherDto.userId,
      amount: createVoucherDto.amount,
      expiresAt,
      used: false,
      metadata: {
        ...(createVoucherDto.metadata ?? {}),
        sourceType: createVoucherDto.sourceType ?? 'MANUAL',
        sourceReferenceId: createVoucherDto.sourceReferenceId,
        maxActiveVouchersPerUser: createVoucherDto.maxActiveVouchersPerUser,
        usageCount: 0,
        usageHistory: [],
      },
    });
    return voucherRepo.save(voucher);
  }

  /**
   * List vouchers for a user. By default returns only active (unused, not expired).
   */
  async getUserVouchers(
    userId: string,
    page = 1,
    limit = 10,
    includeUsed = false,
  ): Promise<PaginatedVouchers> {
    await this.markExpiredVouchersForUser(userId);

    const skip = (page - 1) * limit;
    const now = new Date();

    const qb = this.voucherRepository
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId });

    if (!includeUsed) {
      qb.andWhere('v.used = :used', { used: false }).andWhere(
        'v.expiresAt > :now',
        { now },
      );
    }

    const [data, total] = await qb
      .orderBy('v.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single voucher by id. Validates ownership if userId is provided.
   */
  async getVoucherById(
    voucherId: string,
    userId?: string,
  ): Promise<FreeBetVoucher> {
    const voucher = await this.voucherRepository.findOne({
      where: { id: voucherId },
      relations: ['user'],
    });
    if (!voucher) {
      throw new NotFoundException('Free bet voucher not found');
    }
    if (userId && voucher.userId !== userId) {
      throw new ForbiddenException('You do not have access to this voucher');
    }
    return voucher;
  }

  /**
   * Get available (unused, not expired) vouchers for a user.
   * Used when placing a bet to choose a voucher.
   */
  async getAvailableVouchers(userId: string): Promise<FreeBetVoucher[]> {
    await this.markExpiredVouchersForUser(userId);

    const now = new Date();
    return this.voucherRepository
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.used = :used', { used: false })
      .andWhere('v.expiresAt > :now', { now })
      .orderBy('v.expiresAt', 'ASC')
      .addOrderBy('v.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Validate a voucher for use. Throws if invalid.
   * Used by BetsService before applying a voucher to a bet.
   */
  async validateVoucher(
    voucherId: string,
    userId: string,
  ): Promise<FreeBetVoucher> {
    const voucher = await this.voucherRepository.findOne({
      where: { id: voucherId },
    });
    if (!voucher) {
      throw new NotFoundException('Free bet voucher not found');
    }

    this.assertVoucherUsable(voucher, userId);

    return voucher;
  }

  async updateVoucher(
    voucherId: string,
    updateVoucherDto: UpdateFreeBetVoucherDto,
  ): Promise<FreeBetVoucher> {
    const voucher = await this.voucherRepository.findOne({
      where: { id: voucherId },
    });
    if (!voucher) {
      throw new NotFoundException('Free bet voucher not found');
    }

    if (updateVoucherDto.amount !== undefined) {
      if (updateVoucherDto.amount <= 0) {
        throw new BadRequestException('Voucher amount must be positive');
      }
      voucher.amount = updateVoucherDto.amount;
    }

    if (updateVoucherDto.expiresAt) {
      const expiresAt = new Date(updateVoucherDto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new BadRequestException('Expiration date must be in the future');
      }
      voucher.expiresAt = expiresAt;
    }

    if (updateVoucherDto.maxActiveVouchersPerUser) {
      const activeCount = await this.voucherRepository
        .createQueryBuilder('v')
        .where('v.userId = :userId', { userId: voucher.userId })
        .andWhere('v.id != :voucherId', { voucherId: voucher.id })
        .andWhere('v.used = :used', { used: false })
        .andWhere('v.expiresAt > :now', { now: new Date() })
        .getCount();

      if (activeCount >= updateVoucherDto.maxActiveVouchersPerUser) {
        throw new ConflictException(
          `User already has the maximum number of active vouchers (${updateVoucherDto.maxActiveVouchersPerUser})`,
        );
      }
    }

    voucher.metadata = {
      ...(voucher.metadata ?? {}),
      ...(updateVoucherDto.metadata ?? {}),
      maxActiveVouchersPerUser:
        updateVoucherDto.maxActiveVouchersPerUser ??
        voucher.metadata?.maxActiveVouchersPerUser,
    };

    return this.voucherRepository.save(voucher);
  }

  async deleteVoucher(voucherId: string): Promise<void> {
    const voucher = await this.voucherRepository.findOne({
      where: { id: voucherId },
    });
    if (!voucher) {
      throw new NotFoundException('Free bet voucher not found');
    }

    await this.voucherRepository.softRemove(voucher);
  }

  /**
   * Consume a voucher when it is used for a bet.
   * Called by BetsService after a bet is created with a voucher.
   * Automatically consumed on use.
   */
  async consumeVoucher(
    voucherId: string,
    userId: string,
    betId: string,
  ): Promise<FreeBetVoucher> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const voucher = await qr.manager.findOne(FreeBetVoucher, {
        where: { id: voucherId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!voucher) {
        throw new NotFoundException('Free bet voucher not found');
      }

      this.assertVoucherUsable(voucher, userId);

      const usedAt = new Date();
      voucher.used = true;
      voucher.usedAt = usedAt;
      voucher.usedForBetId = betId;
      voucher.metadata = this.withUsageTracking(voucher.metadata, {
        usedAt,
        betId,
      });
      const saved = await qr.manager.save(voucher);
      await qr.commitTransaction();
      return saved;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async consumeVoucherWithManager(
    manager: EntityManager,
    voucherId: string,
    userId: string,
    betId: string,
  ): Promise<FreeBetVoucher> {
    const voucher = await manager.findOne(FreeBetVoucher, {
      where: { id: voucherId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!voucher) {
      throw new NotFoundException('Free bet voucher not found');
    }

    this.assertVoucherUsable(voucher, userId);

    const usedAt = new Date();
    voucher.used = true;
    voucher.usedAt = usedAt;
    voucher.usedForBetId = betId;
    voucher.metadata = this.withUsageTracking(voucher.metadata, {
      usedAt,
      betId,
    });
    return manager.save(voucher);
  }

  async restoreVoucher(
    voucherId: string,
    userId: string,
    betId?: string,
  ): Promise<FreeBetVoucher> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const saved = await this.restoreVoucherWithManager(
        qr.manager,
        voucherId,
        userId,
        betId,
      );

      await qr.commitTransaction();
      return saved;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async restoreVoucherWithManager(
    manager: EntityManager,
    voucherId: string,
    userId: string,
    betId?: string,
  ): Promise<FreeBetVoucher> {
    const voucher = await manager.findOne(FreeBetVoucher, {
      where: { id: voucherId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!voucher) {
      throw new NotFoundException('Free bet voucher not found');
    }
    if (voucher.userId !== userId) {
      throw new ForbiddenException('You do not have access to this voucher');
    }
    if (betId && voucher.usedForBetId && voucher.usedForBetId !== betId) {
      throw new ConflictException(
        'Voucher is linked to a different bet and cannot be restored',
      );
    }
    if (this.isVoucherExpired(voucher)) {
      throw new BadRequestException('Voucher has expired and cannot be restored');
    }

    voucher.used = false;
    voucher.usedAt = undefined;
    voucher.usedForBetId = undefined;
    voucher.metadata = {
      ...(voucher.metadata ?? {}),
      restoreCount: Number(voucher.metadata?.restoreCount ?? 0) + 1,
      lastRestoredAt: new Date().toISOString(),
    };
    return manager.save(voucher);
  }

  /**
   * Stats for a user's vouchers.
   */
  async getUserVoucherStats(userId: string): Promise<{
    totalVouchers: number;
    activeVouchers: number;
    usedVouchers: number;
    expiredVouchers: number;
    totalValue: number;
    activeValue: number;
  }> {
    await this.markExpiredVouchersForUser(userId);

    const list = await this.voucherRepository.find({ where: { userId } });
    const stats = {
      totalVouchers: list.length,
      activeVouchers: 0,
      usedVouchers: 0,
      expiredVouchers: 0,
      totalValue: 0,
      activeValue: 0,
    };

    for (const v of list) {
      const amt = Number(v.amount);
      stats.totalValue += amt;
      if (v.used) {
        stats.usedVouchers++;
      } else if (this.isVoucherExpired(v)) {
        stats.expiredVouchers++;
      } else {
        stats.activeVouchers++;
        stats.activeValue += amt;
      }
    }
    return stats;
  }

  private assertVoucherUsable(voucher: FreeBetVoucher, userId: string): void {
    if (voucher.userId !== userId) {
      throw new ForbiddenException('You do not have access to this voucher');
    }
    if (voucher.used) {
      throw new ConflictException('Voucher has already been used');
    }
    if (this.isVoucherExpired(voucher)) {
      throw new BadRequestException('Voucher has expired');
    }
  }

  private isVoucherExpired(voucher: FreeBetVoucher): boolean {
    return new Date() > new Date(voucher.expiresAt);
  }

  private withUsageTracking(
    metadata: Record<string, any> | undefined,
    usage: { usedAt: Date; betId: string },
  ): Record<string, any> {
    const current = metadata ?? {};
    const currentHistory = Array.isArray(current.usageHistory)
      ? current.usageHistory
      : [];

    return {
      ...current,
      usageCount: Number(current.usageCount ?? 0) + 1,
      lastUsedAt: usage.usedAt.toISOString(),
      lastUsedForBetId: usage.betId,
      usageHistory: [
        ...currentHistory,
        {
          usedAt: usage.usedAt.toISOString(),
          betId: usage.betId,
        },
      ].slice(-20),
    };
  }

  private async markExpiredVouchersForUser(userId: string): Promise<void> {
    const now = new Date();
    const vouchers = await this.voucherRepository
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.used = :used', { used: false })
      .andWhere('v.expiresAt <= :now', { now })
      .getMany();

    if (vouchers.length === 0) {
      return;
    }

    for (const voucher of vouchers) {
      voucher.metadata = {
        ...(voucher.metadata ?? {}),
        status: 'EXPIRED',
        expiredAt:
          typeof voucher.metadata?.expiredAt === 'string'
            ? voucher.metadata.expiredAt
            : now.toISOString(),
      };
    }

    await this.voucherRepository.save(vouchers);
  }
}
