import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SeasonStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('seasons')
@Index(['status'])
@Index(['startDate', 'endDate'])
export class Season extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ name: 'season_number' })
  seasonNumber: number;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: SeasonStatus,
    default: SeasonStatus.ACTIVE,
  })
  status: SeasonStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'bronze_threshold',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  bronzeThreshold: number;

  @Column({
    name: 'silver_threshold',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 1000,
  })
  silverThreshold: number;

  @Column({
    name: 'gold_threshold',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 5000,
  })
  goldThreshold: number;
}
