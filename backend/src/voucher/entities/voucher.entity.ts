import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VoucherStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  campaignName: string;

  @Column({ type: 'decimal' })
  amount: number;

  @Column({ type: 'timestamp' })
  expiryDate: Date;

  @Column({ default: 1 })
  usageLimitPerUser: number;

  @Column({ default: 0 })
  totalRedemptions: number;

  @Column({ default: 0 })
  maxGlobalUsage: number;

  @Column({
    type: 'enum',
    enum: VoucherStatus,
    default: VoucherStatus.ACTIVE,
  })
  status: VoucherStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  
}