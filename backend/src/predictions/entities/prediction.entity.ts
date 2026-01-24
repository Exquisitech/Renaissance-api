import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Match, MatchOutcome } from '../../matches/entities/match.entity';

export enum PredictionStatus {
  PENDING = 'pending',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  CANCELLED = 'cancelled',
}

@Entity('predictions')
@Index(['userId', 'matchId'], { unique: true })
@Index(['userId'])
@Index(['matchId'])
@Index(['status'])
@Index(['userId', 'status'])
export class Prediction extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'match_id' })
  matchId: string;

  @Column({
    name: 'predicted_outcome',
    type: 'enum',
    enum: MatchOutcome,
  })
  predictedOutcome: MatchOutcome;

  @Column({
    type: 'enum',
    enum: PredictionStatus,
    default: PredictionStatus.PENDING,
  })
  status: PredictionStatus;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;
}
