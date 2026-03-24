import { TriggerEvent, RuleType } from './entities/achievement.entity';
import { CreateAchievementDto } from './dto/create-achievement.dto';

export const badgeSeedData: CreateAchievementDto[] = [
  {
    name: '10 Consecutive Wins',
    description: 'Win 10 bets in a row',
    triggerEvent: TriggerEvent.BET_SETTLED,
    ruleType: RuleType.SPECIFIC_CONDITION,
    targetValue: 10,
    metadata: { winStreak: 10 },
    rewardPoints: 100,
    isActive: true,
  },
  {
    name: '100 XLM Staked',
    description: 'Stake a total of 100 XLM',
    triggerEvent: TriggerEvent.STAKING_EVENT,
    ruleType: RuleType.SUM_AMOUNT,
    targetValue: 100,
    metadata: { asset: 'XLM' },
    rewardPoints: 100,
    isActive: true,
  },
  {
    name: 'First NFT Earned',
    description: 'Earn your first NFT',
    triggerEvent: TriggerEvent.NFT_EARNED,
    ruleType: RuleType.COUNT,
    targetValue: 1,
    rewardPoints: 100,
    isActive: true,
  },
  {
    name: '50 Spins Completed',
    description: 'Complete 50 spins',
    triggerEvent: TriggerEvent.SPIN_RESULT,
    ruleType: RuleType.COUNT,
    targetValue: 50,
    rewardPoints: 100,
    isActive: true,
  },
  {
    name: 'Top 10 Leaderboard Finish',
    description: 'Finish in the top 10 of the leaderboard',
    triggerEvent: TriggerEvent.LEADERBOARD_UPDATE,
    ruleType: RuleType.SPECIFIC_CONDITION,
    targetValue: 1,
    metadata: { rank: 10 },
    rewardPoints: 100,
    isActive: true,
  },
];
