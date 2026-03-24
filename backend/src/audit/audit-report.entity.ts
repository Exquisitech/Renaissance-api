import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('audit_reports')
export class AuditReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  status: string; // e.g. 'PASS', 'FAIL', 'WARNING'

  @Column('jsonb')
  violations: AuditViolation[];

  @CreateDateColumn()
  createdAt: Date;
}

export class AuditViolation {
  type: string; // e.g. 'TREASURY_MISMATCH', 'ESCROW_MISMATCH', 'NFT_MINT_MISMATCH'
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  details?: any;
}
