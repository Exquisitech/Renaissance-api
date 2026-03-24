import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('system_controls')
@Index(['key'], { unique: true })
export class SystemControl {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'is_paused', type: 'boolean', default: false })
  isPaused: boolean;

  @Column({ name: 'paused_at', type: 'timestamp', nullable: true })
  pausedAt: Date | null;

  @Column({ name: 'paused_by', type: 'varchar', length: 64, nullable: true })
  pausedBy: string | null;

  @Column({ name: 'pause_reason', type: 'text', nullable: true })
  pauseReason: string | null;

  @Column({
    name: 'last_updated_by',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  lastUpdatedBy: string | null;
}
