import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('players')
@Index(['name'])
@Index(['team'])
@Index(['position'])
@Index(['nationality'])
export class Player extends BaseEntity {
  @Column({ unique: true })
  externalId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  team: string;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  nationality: string;

  @Column({ type: 'date', nullable: true })
  birthDate: Date;

  @Column({ nullable: true })
  age: number;

  @Column({ nullable: true })
  height: string;

  @Column({ nullable: true })
  weight: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ nullable: true })
  shirtNumber: number;

  @Column({ nullable: true })
  marketValue: string;

  @Column({ type: 'json', nullable: true })
  statistics: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  career: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  honors: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  injuries: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  transfers: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdated: Date;
}
