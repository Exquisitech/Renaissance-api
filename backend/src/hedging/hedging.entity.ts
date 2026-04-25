// hedging.entity.ts

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('hedges')
export class Hedge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalBetId: string;

  @Column()
  hedgeBetId: string;

  @Column('float')
  originalAmount: number;

  @Column('float')
  hedgeAmount: number;

  @Column('float')
  effectiveness: number;
}