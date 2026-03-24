import { NFTTier } from '../dto/spin-game.dto';

export interface XLMRewardTier {
  name: string;
  multiplier: number;
  probability: number;
  maxAmount: number;
  withdrawable: boolean;
  requiresVerification?: boolean;
  requiresKYC?: boolean;
}

export interface FreeBetRewardTier {
  name: string;
  multiplier: number;
  probability: number;
  validityDays: number;
  withdrawable: boolean;
  minBetAmount?: number;
}

export const SPIN_GAME_CONFIG = {
  // Minimum and maximum stakes (in XLM)
  MINIMUM_STAKE: 10,
  MAXIMUM_STAKE: 1000,

  // Daily limits for anti-abuse
  DAILY_SPIN_LIMIT: 50,
  DAILY_STAKE_LIMIT: 5000,

  // Cool-down period between spins (seconds)
  SPIN_COOLDOWN_SECONDS: 30,

  // House edge configuration
  HOUSE_EDGE_PERCENTAGE: 5, // 5% house edge

  // Probability distribution (must sum to 100%)
  PROBABILITY_DISTRIBUTION: {
    LOSS: 55, // 55% chance of losing
    XLM_REWARD: 35, // 35% chance of XLM reward
    FREE_BET_REWARD: 8, // 8% chance of free bet (non-withdrawable)
    NFT_REWARD: 2, // 2% chance of NFT (non-withdrawable)
  },

  // XLM Reward Tiers with probabilities and caps
  XLM_REWARD_TIERS: [
    {
      name: 'SMALL_WIN',
      multiplier: 1.1,
      probability: 50, // 50% of XLM rewards
      maxAmount: 100, // Cap at 100 XLM
      withdrawable: true,
    },
    {
      name: 'MEDIUM_WIN',
      multiplier: 1.25,
      probability: 25, // 25% of XLM rewards
      maxAmount: 250,
      withdrawable: true,
    },
    {
      name: 'GOOD_WIN',
      multiplier: 1.5,
      probability: 15, // 15% of XLM rewards
      maxAmount: 500,
      withdrawable: true,
    },
    {
      name: 'BIG_WIN',
      multiplier: 2,
      probability: 7, // 7% of XLM rewards
      maxAmount: 1000,
      withdrawable: true,
      requiresVerification: true,
    },
    {
      name: 'MAJOR_WIN',
      multiplier: 5,
      probability: 2.5, // 2.5% of XLM rewards
      maxAmount: 2500,
      withdrawable: true,
      requiresVerification: true,
    },
    {
      name: 'JACKPOT',
      multiplier: 10,
      probability: 0.5, // 0.5% of XLM rewards
      maxAmount: 5000,
      withdrawable: true,
      requiresVerification: true,
      requiresKYC: true,
    },
  ] as readonly XLMRewardTier[],

  // Free Bet Reward Tiers (Non-Withdrawable)
  FREE_BET_TIERS: [
    {
      name: 'SMALL_FREE_BET',
      multiplier: 0.5,
      probability: 60, // 60% of free bet rewards
      validityDays: 30,
      withdrawable: false,
    },
    {
      name: 'STANDARD_FREE_BET',
      multiplier: 1,
      probability: 30, // 30% of free bet rewards
      validityDays: 30,
      withdrawable: false,
    },
    {
      name: 'BIG_FREE_BET',
      multiplier: 2,
      probability: 10, // 10% of free bet rewards
      validityDays: 30,
      withdrawable: false,
      minBetAmount: 50,
    },
  ] as readonly FreeBetRewardTier[],

  // NFT Reward Probabilities (within the 2% NFT chance)
  NFT_TIER_PROBABILITIES: {
    [NFTTier.COMMON]: 70, // 70% of NFT rewards (1.4% overall chance)
    [NFTTier.RARE]: 20, // 20% of NFT rewards (0.4% overall chance)
    [NFTTier.EPIC]: 8, // 8% of NFT rewards (0.16% overall chance)
    [NFTTier.LEGENDARY]: 2, // 2% of NFT rewards (0.04% overall chance)
  },

  // NFT Metadata and Values
  NFT_CONFIG: {
    [NFTTier.COMMON]: {
      name: 'Common Player Card',
      maxSupply: 10000,
      withdrawable: false,
      tradeable: true,
    },
    [NFTTier.RARE]: {
      name: 'Rare Player Card',
      maxSupply: 2000,
      withdrawable: false,
      tradeable: true,
    },
    [NFTTier.EPIC]: {
      name: 'Epic Player Card',
      maxSupply: 500,
      withdrawable: false,
      tradeable: true,
      stakingRewards: true,
    },
    [NFTTier.LEGENDARY]: {
      name: 'Legendary Player Card',
      maxSupply: 100,
      withdrawable: false,
      tradeable: true,
      stakingRewards: true,
      exclusiveContent: true,
    },
  },

  // Streak-based bonuses (for consecutive losses)
  STREAK_BONUSES: {
    5: {
      probabilityBoost: 5, // +5% win probability
      message: 'Lucky Streak Bonus Activated!',
    },
    10: {
      probabilityBoost: 10, // +10% win probability
      freeSpin: true, // Free spin on next loss
      message: 'Big Bonus Activated! Free spin awarded!',
    },
    15: {
      probabilityBoost: 15,
      guaranteedWin: true, // Guaranteed win on next spin
      minRewardTier: 'MEDIUM_WIN',
      message: 'Guaranteed Win Activated!',
    },
  },

  // RNG Configuration for provably fair system
  RNG: {
    SEED_LENGTH: 64,
    HASH_ALGORITHM: 'sha256',
    CLIENT_SEED_REQUIRED: false,
    SERVER_SEED_ROTATION_HOURS: 24,
  },

  // Audit & Security
  SECURITY: {
    MAX_WINNING_STREAK: 3,
    SUSPICIOUS_ACTIVITY_THRESHOLD: 100,
    AUTO_FLAG_LARGE_WINS: true,
    LARGE_WIN_THRESHOLD: 1000, // XLM
    MANDATORY_VERIFICATION_AMOUNT: 5000, // XLM
  },

  // Compliance
  COMPLIANCE: {
    MINIMUM_AGE: 18,
    GEO_RESTRICTIONS: [], // Add restricted countries
    SELF_EXCLUSION_ENABLED: true,
    LOSS_LIMITS_ENABLED: true,
    DAILY_LOSS_LIMIT: 1000,
    WEEKLY_LOSS_LIMIT: 5000,
    MONTHLY_LOSS_LIMIT: 20000,
  },
} as const;

export type SpinGameConfig = typeof SPIN_GAME_CONFIG;
