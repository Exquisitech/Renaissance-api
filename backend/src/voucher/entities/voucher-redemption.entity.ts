@Entity('voucher_redemptions')
export class VoucherRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  voucherId: string;

  @Column({ default: 1 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;
}