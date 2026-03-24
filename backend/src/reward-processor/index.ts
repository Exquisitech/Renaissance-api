import { IEvent } from '@nestjs/cqrs';

// ─── Existing Events ──────────────────────────────────────────────────────────

/**
 * Emitted when a user's funds are locked into a stake (wallet debited).
 * Leaderboard handler should increment totalStaked.
 */
export class StakeDebitedEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly amount: number,
    public readonly operation: string,
  ) {}
}

/**
 * Emitted when a completed stake is claimed (principal + reward returned).
 * Leaderboard handler should update totalEarnings.
 */
export class StakeCreditedEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly stakedAmount: number,
    public readonly rewardAmount: number,
  ) {}
}

// ─── New Event ────────────────────────────────────────────────────────────────

/**
 * Emitted by the RewardProcessor cron job after it automatically distributes
 * a matured staking reward to a user.
 *
 * Consumers:
 *  - LeaderboardHandler  → update UserLeaderboardStats.totalEarnings
 *  - NotificationHandler → push "Your reward is ready!" to frontend via WS/SSE
 */
export class StakingRewardProcessedEvent implements IEvent {
  constructor(
    /** The user who received the reward */
    public readonly userId: string,
    /** Original principal that was staked */
    public readonly stakedAmount: number,
    /** Reward tokens credited on top of the principal */
    public readonly rewardAmount: number,
    /** Total credited to wallet = stakedAmount + rewardAmount */
    public readonly totalCredited: number,
    /** The STAKING_REWARD transaction id for traceability */
    public readonly rewardTransactionId: string,
    /** The original STAKING_PENALTY transaction id that triggered this */
    public readonly originalStakeId: string,
  ) {}
}
