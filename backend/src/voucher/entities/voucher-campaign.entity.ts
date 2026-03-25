import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Voucher } from './voucher.entity';

@Entity('voucher_campaigns')
export class VoucherCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @OneToMany(() => Voucher, (voucher) => voucher.campaign)
  vouchers: Voucher[];
}