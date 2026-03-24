import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Leaderboard } from '../leaderboard/entities/leaderboard.entity';
import { UserSpinStats } from '../spin-game/entities/user-spin-stats.entity';
import { ProgressDto } from '../common/dto/progress.dto';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Leaderboard)
    private readonly leaderboardRepo: Repository<Leaderboard>,
    @InjectRepository(UserSpinStats)
    private readonly spinStatsRepo: Repository<UserSpinStats>,
    private readonly dataSource: DataSource,
  ) {}

  async getUserProgress(userId: string): Promise<ProgressDto> {
    // Fetch both stats in parallel
    const [leaderboard, spinStats] = await Promise.all([
      this.leaderboardRepo.findOne({ where: { userId } }),
      this.spinStatsRepo.findOne({ where: { userId } }),
    ]);

    if (!leaderboard && !spinStats) {
      throw new Error('User stats not found');
    }

    return {
      userId,
      currentWinStreak: leaderboard?.winningStreak ?? 0,
      highestWinStreak: leaderboard?.highestWinningStreak ?? 0,
      totalLifetimeSpins: spinStats?.totalSpins ?? 0,
      totalEarnings: leaderboard?.totalWinnings ?? 0,
      accuracy: leaderboard?.bettingAccuracy ?? 0,
      totalBets: leaderboard?.totalBets ?? 0,
      betsWon: leaderboard?.betsWon ?? 0,
      betsLost: leaderboard?.betsLost ?? 0,
      totalStaked: leaderboard?.totalStaked ?? 0,
      spinsToday: spinStats?.spinsToday ?? 0,
      maxSpinStreak: spinStats?.maxStreak ?? 0,
    };
  }
}
