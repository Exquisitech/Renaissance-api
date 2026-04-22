import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_balance_snapshots')
export class UserBalanceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'numeric', precision: 20, scale: 0 })
  balance: number;

  @Column({ type: 'text' })
  balanceHash: string;

  @Column({ type: 'uuid', name: 'proof_id', nullable: true })
  proofId: string | null;

  @Index()
  @Column({ type: 'timestamp' })
  snapshotTimestamp: Date;

  @Column({ type: 'int', name: 'leaf_index', nullable: true })
  leafIndex: number | null;

  @Column({ type: 'jsonb', nullable: true })
  merkleProof: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
