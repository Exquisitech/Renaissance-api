import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

@Entity('transactions')
@Index(['userId', 'createdAt']) // 🔥 for pagination + filtering
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  @Index()
  type: TransactionType;

  @Column('decimal')
  amount: number;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}