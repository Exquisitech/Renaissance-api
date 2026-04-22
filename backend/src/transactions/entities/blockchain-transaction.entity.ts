import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

export enum TransactionType {
  PAYMENT = 'payment',
  CONTRACT_CALL = 'contract_call',
  TOKEN_TRANSFER = 'token_transfer',
  BET_PLACEMENT = 'bet_placement',
  BET_SETTLEMENT = 'bet_settlement',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
}

@Entity('blockchain_transactions')
@Index(['hash'])
@Index(['userId'])
@Index(['status'])
@Index(['type'])
export class BlockchainTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'public_key', nullable: true })
  publicKey: string | null;

  @Column({ unique: true })
  hash: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ name: 'transaction_xdr' })
  transactionXDR: string;

  @Column({ name: 'result_xdr', nullable: true })
  resultXDR: string;

  @Column({ name: 'ledger', nullable: true })
  ledger: number;

  @Column({ name: 'confirmations', default: 0 })
  confirmations: number;

  @Column({ name: 'required_confirmations', default: 1 })
  requiredConfirmations: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'submitted_at', nullable: true })
  submittedAt: Date;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
