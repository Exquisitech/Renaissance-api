import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum OddsUpdateSource {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  MATCH_UPDATE = 'match_update',
}

@Entity('match_odds_history')
@Index(['matchId'])
@Index(['matchId', 'createdAt'])
@Index(['source'])
export class MatchOddsHistory extends BaseEntity {
  @Column({ name: 'match_id' })
  matchId: string;

  @Column({
    name: 'previous_home_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  previousHomeOdds: number;

  @Column({
    name: 'previous_draw_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  previousDrawOdds: number;

  @Column({
    name: 'previous_away_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  previousAwayOdds: number;

  @Column({
    name: 'new_home_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  newHomeOdds: number;

  @Column({
    name: 'new_draw_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  newDrawOdds: number;

  @Column({
    name: 'new_away_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  newAwayOdds: number;

  @Column({
    type: 'enum',
    enum: OddsUpdateSource,
  })
  source: OddsUpdateSource;

  @Column({ name: 'changed_by_user_id', nullable: true })
  changedByUserId: string | null;

  @Column({ nullable: true })
  reason: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;
}
