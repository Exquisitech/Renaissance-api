import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum CardRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

@Entity('player_card_metadata')
@Index(['contractAddress', 'tokenId'], { unique: true })
@Index(['playerId'])
@Index(['rarity'])
@Index(['isPublished'])
@Index(['season'])
@Index(['isPublished', 'rarity'])
export class PlayerCardMetadata extends BaseEntity {
  @Column({ name: 'player_id' })
  playerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'player_id' })
  player: User;

  @Column({ name: 'contract_address' })
  contractAddress: string;

  @Column({ name: 'token_id' })
  tokenId: string;

  @Column({ name: 'token_uri' })
  tokenUri: string;

  @Column({ name: 'player_name' })
  playerName: string;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  team: string;

  @Column({
    type: 'enum',
    enum: CardRarity,
    default: CardRarity.COMMON,
  })
  rarity: CardRarity;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ name: 'season', nullable: true })
  season: string;

  @Column({ name: 'edition_number', nullable: true })
  editionNumber: number;

  @Column({ name: 'total_supply', nullable: true })
  totalSupply: number;

  @Column({ type: 'simple-json', nullable: true })
  attributes: Record<string, string | number>;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'external_url', nullable: true })
  externalUrl: string;

  @Column({ default: true })
  isPublished: boolean;

  @Column({ nullable: true })
  metadata: string;
}
