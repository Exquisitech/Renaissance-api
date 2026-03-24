import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SettlementStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Entity()
@Index(['status'])
@Index(['betId'])
@Index(['referenceId'])
export class Settlement extends BaseEntity {
  @Column({ unique: true })
  referenceId: string;

  @Column()
  betId: string;

  @Column('decimal', { precision: 18, scale: 7 })
  amount: number;

  @Column()
  outcome: string;

  @Column({ nullable: true })
  txHash: string;

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PENDING,
  })
  status: SettlementStatus;
}
// ...BaseEntity fields: id, createdAt, updatedAt, deletedAt
