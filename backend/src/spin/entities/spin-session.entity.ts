import { Entity, Column, Index, BeforeUpdate } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Enum representing the type of reward from a spin session.
 */
export enum RewardType {
  XP = 'xp',
  TOKENS = 'tokens',
  NFT = 'nft',
  BONUS_SPIN = 'bonus_spin',
  MULTIPLIER = 'multiplier',
  NONE = 'none',
}

/**
 * Enum representing the status of a spin session.
 */
export enum SpinSessionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * SpinSession entity for tracking every spin attempt for auditability and fairness.
 *
 * Key Features:
 * - Immutable after completion (status changes to completed/failed prevent further updates)
 * - Indexed by userId and createdAt for efficient querying
 * - Stores transaction reference for blockchain audit trail
 */
@Entity('spin_sessions')
@Index(['userId', 'createdAt'])
@Index(['userId'])
export class SpinSession extends BaseEntity {
  @Column('uuid')
  @Index()
  userId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  stakeAmount: number;

  @Column('enum', { enum: RewardType, default: RewardType.NONE })
  rewardType: RewardType;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  rewardValue: number;

  @Column('enum', {
    enum: SpinSessionStatus,
    default: SpinSessionStatus.PENDING,
  })
  status: SpinSessionStatus;

  @Column('varchar', { length: 255, nullable: true })
  txReference: string | null;

  // ...BaseEntity fields: id, createdAt, updatedAt, deletedAt

  /**
   * Prevents updates to completed or failed spin sessions to ensure immutability.
   * This is a critical audit requirement - once a spin is finalized, it cannot be altered.
   */
  @BeforeUpdate()
  preventUpdateAfterCompletion() {
    // Note: This hook only fires on entity updates via TypeORM save()
    // For complete protection, use service-layer validation as well
    if (
      this.status === SpinSessionStatus.COMPLETED ||
      this.status === SpinSessionStatus.FAILED
    ) {
      throw new Error(
        `Cannot update SpinSession ${this.id}: Session is immutable after ${this.status} status`,
      );
    }
  }
}
