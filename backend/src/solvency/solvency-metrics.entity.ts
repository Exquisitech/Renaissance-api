import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('solvency_metrics')
@Index(['createdAt'])
export class SolvencyMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 30, scale: 8 })
  totalLockedBets: number;

  @Column('decimal', { precision: 30, scale: 8 })
  maxPotentialPayout: number;

  @Column('decimal', { precision: 30, scale: 8 })
  treasuryBalance: number;

  @Column('decimal', { precision: 18, scale: 8 })
  coverageRatio: number;

  @Column('decimal', { precision: 30, scale: 8 })
  spinPoolLiabilities: number;

  @Column('decimal', { precision: 18, scale: 8 })
  spinPoolSolvency: number;

  @CreateDateColumn()
  createdAt: Date;
}
