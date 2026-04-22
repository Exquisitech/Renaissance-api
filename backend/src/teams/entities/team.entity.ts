import { Column, Entity, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Match } from '../../matches/entities/match.entity';

@Entity('teams')
@Index(['name'])
@Index(['league'])
@Index(['league', 'name'])
export class Team extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  shortName: string;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  league: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  founded: number;

  @Column({ nullable: true })
  stadium: string;

  @Column({ nullable: true })
  capacity: number;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Match, (match) => match.homeTeam)
  homeMatches: Match[];

  @OneToMany(() => Match, (match) => match.awayTeam)
  awayMatches: Match[];
}
