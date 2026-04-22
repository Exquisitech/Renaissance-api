import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ProofStatus {
  GENERATED = 'generated',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

@Entity('solvency_proofs')
export class SolvencyProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  proofNumber: string;

  @Column({ type: 'timestamp' })
  proofTimestamp: Date;

  @Column({ type: 'text' })
  merkleRoot: string;

  @Column({ type: 'numeric', precision: 20, scale: 0 })
  totalLiabilities: number;

  @Column({ type: 'numeric', precision: 20, scale: 0 })
  totalReserves: number;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  solvencyRatio: number;

  @Column({
    type: 'enum',
    enum: ProofStatus,
    default: ProofStatus.GENERATED,
  })
  status: ProofStatus;

  @Column({ type: 'text', nullable: true })
  transactionHash: string | null;

  @Column({ type: 'int', name: 'block_number', nullable: true })
  blockNumber: number | null;

  @Column({ type: 'jsonb' })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;
}
