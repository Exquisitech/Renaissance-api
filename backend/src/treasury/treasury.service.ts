import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TreasuryDistribution, TreasuryDistributionItem } from './entities/treasury.entity';
import { WalletService } from '../wallet/services/wallet.service';

export interface DistributionRecipient {
  playerId: string;
  amount: number;
}

@Injectable()
export class TreasuryService {
  constructor(
    @InjectRepository(TreasuryDistribution)
    private distRepo: Repository<TreasuryDistribution>,
    @InjectRepository(TreasuryDistributionItem)
    private itemRepo: Repository<TreasuryDistributionItem>,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  async createDistribution(recipients: DistributionRecipient[]): Promise<TreasuryDistribution> {
    if (!recipients.length) throw new BadRequestException('No recipients provided');

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);

    const dist = this.distRepo.create({
      totalAmount,
      recipientCount: recipients.length,
      status: 'PENDING',
    });
    const saved = await this.distRepo.save(dist);

    const items = recipients.map((r) =>
      this.itemRepo.create({ distributionId: saved.id, playerId: r.playerId, amount: r.amount }),
    );
    await this.itemRepo.save(items);

    return saved;
  }

  async processDistribution(distributionId: string): Promise<TreasuryDistribution> {
    const dist = await this.distRepo.findOne({ where: { id: distributionId } });
    if (!dist) throw new NotFoundException('Distribution not found');
    if (dist.status !== 'PENDING') throw new BadRequestException(`Distribution is ${dist.status}`);

    dist.status = 'PROCESSING';
    await this.distRepo.save(dist);

    const items = await this.itemRepo.find({ where: { distributionId, credited: false } });
    let failed = false;

    for (const item of items) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await this.walletService.credit(item.playerId, item.amount, 'TREASURY_DIST');
        item.credited = true;
        item.creditedAt = new Date();
        await queryRunner.manager.save(item);
        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        failed = true;
        // Continue processing other recipients — log failure
        console.error(`Failed to credit player ${item.playerId}:`, err);
      } finally {
        await queryRunner.release();
      }
    }

    dist.status = failed ? 'FAILED' : 'COMPLETED';
    dist.processedAt = new Date();
    if (failed) dist.failureReason = 'Some recipients failed — check items table';
    return this.distRepo.save(dist);
  }

  async getDistribution(id: string): Promise<{ distribution: TreasuryDistribution; items: TreasuryDistributionItem[] }> {
    const distribution = await this.distRepo.findOne({ where: { id } });
    if (!distribution) throw new NotFoundException('Distribution not found');
    const items = await this.itemRepo.find({ where: { distributionId: id } });
    return { distribution, items };
  }

  async listDistributions(): Promise<TreasuryDistribution[]> {
    return this.distRepo.find({ order: { createdAt: 'DESC' } });
  }
}