import { Column, Entity, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Prediction } from '../../predictions/entities/prediction.entity';

export enum MatchStatus {
  UPCOMING = 'upcoming',
  LIVE = 'live',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
}

export enum MatchOutcome {
  HOME_WIN = 'home_win',
  AWAY_WIN = 'away_win',
  DRAW = 'draw',
}

@Entity('matches')
@Index(['status'])
@Index(['startTime'])
@Index(['league'])
@Index(['season'])
@Index(['status', 'startTime'])
export class Match extends BaseEntity {
  @Column({ name: 'home_team' })
  homeTeam: string;

  @Column({ name: 'away_team' })
  awayTeam: string;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.UPCOMING,
  })
  status: MatchStatus;

  @Column({ name: 'home_score', nullable: true })
  homeScore: number;

  @Column({ name: 'away_score', nullable: true })
  awayScore: number;

  @Column({
    type: 'enum',
    enum: MatchOutcome,
    nullable: true,
  })
  outcome: MatchOutcome;

  @Column({ nullable: true })
  league: string;

  @Column({ nullable: true })
  season: string;

  @Column({
    name: 'home_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 1.5,
  })
  homeOdds: number;

  @Column({
    name: 'draw_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 3.0,
  })
  drawOdds: number;

  @Column({
    name: 'away_odds',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 2.5,
  })
  awayOdds: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Prediction, (prediction) => prediction.match)
  predictions: Prediction[];
}
