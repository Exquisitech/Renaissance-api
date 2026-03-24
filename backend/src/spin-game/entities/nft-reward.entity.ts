import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum NFTTier {
  COMMON = 'COMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

@Entity('nft_rewards')
@Unique(['nftContractAddress', 'nftId'])
export class NFTReward extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 56 })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'nft_contract_address', type: 'varchar', length: 56 })
  nftContractAddress: string;

  @Column({ name: 'nft_id', type: 'varchar' })
  nftId: string;

  @Column({ name: 'metadata_uri', type: 'varchar', nullable: true })
  metadataUri: string | null;

  @Column({
    type: 'enum',
    enum: NFTTier,
    default: NFTTier.COMMON,
  })
  tier: NFTTier;

  @Column({ name: 'is_minted', type: 'boolean', default: false })
  isMinted: boolean;

  @Column({ name: 'mint_transaction_hash', type: 'varchar', nullable: true })
  mintTransactionHash: string | null;

  @Column({ name: 'spin_game_id', type: 'varchar', nullable: true })
  spinGameId: string | null;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt: Date | null;

  // ...BaseEntity fields: id, createdAt, updatedAt, deletedAt

  @Column({ name: 'is_withdrawable', type: 'boolean', default: false })
  isWithdrawable: boolean;

  @Index()
  @Column({ name: 'rarity_score', type: 'int', nullable: true })
  rarityScore: number | null;
}
