// card.entity.ts

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CardRarity } from './card.enums';

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: CardRarity,
  })
  rarity: CardRarity;
}