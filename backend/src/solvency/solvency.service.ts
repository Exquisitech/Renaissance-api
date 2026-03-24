import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolvencyMetrics } from './solvency-metrics.entity';
import { Bet } from '../bets/entities/bet.entity';
import { SolvencyMetricsDto } from './solvency-metrics.dto';

@Injectable()
export class SolvencyService {
  private readonly logger = new Logger(SolvencyService.name);

  constructor(
    @InjectRepository(SolvencyMetrics)
    private readonly metricsRepo: Repository<SolvencyMetrics>,
    @InjectRepository(Bet)
    private readonly betRepo: Repository<Bet>,
    // Inject treasury and spin pool services as needed
  ) {}

  async computeAndStoreMetrics(
    treasuryBalance: number,
    spinPoolLiabilities: number,
  ): Promise<SolvencyMetrics> {
    // Compute locked bets and max potential payout
    const [totalLockedBets, maxPotentialPayout] = await this.betRepo
      .createQueryBuilder('bet')
      .select('SUM(bet.stakeAmount)', 'totalLockedBets')
      .addSelect('SUM(bet.potentialPayout)', 'maxPotentialPayout')
      .where('bet.status = :status', { status: 'LOCKED' })
      .getRawOne()
      .then((res) => [
        Number(res.totalLockedBets) || 0,
        Number(res.maxPotentialPayout) || 0,
      ]);

    const coverageRatio =
      maxPotentialPayout > 0 ? treasuryBalance / maxPotentialPayout : 1;
    const spinPoolSolvency =
      spinPoolLiabilities > 0 ? treasuryBalance / spinPoolLiabilities : 1;

    const metrics = this.metricsRepo.create({
      totalLockedBets,
      maxPotentialPayout,
      treasuryBalance,
      coverageRatio,
      spinPoolLiabilities,
      spinPoolSolvency,
    });
    await this.metricsRepo.save(metrics);
    this.logger.log(
      `Solvency metrics stored: Coverage ratio = ${coverageRatio}`,
    );
    return metrics;
  }

  async getLatestMetrics(): Promise<SolvencyMetricsDto> {
    const latest = await this.metricsRepo.findOne({
      order: { createdAt: 'DESC' },
    });
    if (!latest) throw new Error('No solvency metrics found');
    return latest;
  }

  async getMetricsHistory(days = 30): Promise<SolvencyMetricsDto[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { MoreThan } = await import('typeorm');
    return this.metricsRepo.find({
      where: { createdAt: MoreThan(since) },
      order: { createdAt: 'DESC' },
    });
  }
}
