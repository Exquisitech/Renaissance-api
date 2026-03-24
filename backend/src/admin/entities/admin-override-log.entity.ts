import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Bet } from '../../bets/entities/bet.entity';
import { Spin } from '../../spin/entities/spin.entity';

export enum AdminOverrideAction {
  BALANCE_ADJUSTMENT = 'balance_adjustment',
  BET_OUTCOME_CORRECTION = 'bet_outcome_correction',
  FREE_BET_VOUCHER_ISSUED = 'free_bet_voucher_issued',
  SPIN_REWARD_REVERSAL = 'spin_reward_reversal',
  SETTLEMENT_REVERSAL = 'settlement_reversal',
}

export enum OverrideStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  REJECTED = 'rejected',
  REVERSED = 'reversed',
}

@Entity('admin_override_logs')
@Index(['adminId'])
@Index(['actionType'])
@Index(['createdAt'])
@Index(['affectedUserId'])
@Index(['status'])
@Index(['adminId', 'createdAt'])
@Index(['actionType', 'status'])
export class AdminOverrideLog extends BaseEntity {
  @Column({ name: 'admin_id' })
  adminId: string;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: AdminOverrideAction,
  })
  actionType: AdminOverrideAction;

  @Column({
    type: 'enum',
    enum: OverrideStatus,
    default: OverrideStatus.PENDING,
  })
  status: OverrideStatus;

  @Column({ name: 'affected_user_id', nullable: true })
  affectedUserId: string;

  @Column({ name: 'affected_entity_id', nullable: true })
  affectedEntityId: string;

  @Column({
    name: 'affected_entity_type',
    nullable: true,
    comment: 'Type of affected entity: bet, spin, user, voucher, etc.',
  })
  affectedEntityType: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'json', nullable: true })
  previousValues: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({
    name: 'executed_at',
    type: 'timestamp',
    nullable: true,
  })
  executedAt?: Date;

  @Column({
    name: 'executed_by',
    nullable: true,
  })
  executedBy?: string;

  @Column({
    name: 'requires_onchain_approval',
    type: 'boolean',
    default: false,
    comment:
      'Indicates if this override requires special on-chain settlement approval',
  })
  requiresOnChainApproval: boolean;

  @Column({
    name: 'onchain_approved',
    type: 'boolean',
    default: false,
    comment: 'Whether on-chain settlement override has been approved',
  })
  onChainApproved: boolean;

  @Column({
    name: 'onchain_approval_admin_id',
    nullable: true,
    comment: 'Admin who approved the on-chain override',
  })
  onChainApprovalAdminId?: string;

  @Column({
    name: 'reversal_reason',
    nullable: true,
    comment: 'Reason for reversing the override',
  })
  reversalReason?: string;

  @Column({
    name: 'reversed_by',
    nullable: true,
    comment: 'Admin who reversed the override',
  })
  reversedBy?: string;

  @Column({
    name: 'reversed_at',
    type: 'timestamp',
    nullable: true,
    comment: 'When the override was reversed',
  })
  reversedAt?: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'affected_user_id' })
  affectedUser: User;

  @ManyToOne(() => Bet, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'affected_entity_id' })
  affectedBet: Bet;

  @ManyToOne(() => Spin, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'affected_entity_id' })
  affectedSpin: Spin;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'onchain_approval_admin_id' })
  onChainApprovalAdmin: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reversed_by' })
  reversedByAdmin: User;
}
