import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const RATE_LIMIT_CONFIG_KEYS = {
  INTERACTION_COOLDOWN_SECONDS: 'interaction_cooldown_seconds',
} as const;

/**
 * Admin-configurable rate limit settings.
 * Key: config name, value_seconds: cooldown in seconds.
 */
@Entity('rate_limit_config')
export class RateLimitConfig {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'value_seconds', type: 'int' })
  valueSeconds: number;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', length: 64, nullable: true })
  updatedBy: string | null;
}
