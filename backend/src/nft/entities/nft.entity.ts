import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum RewardType {
  MATCH_ATTENDANCE = 'match_attendance',
  BETTING_WIN = 'betting_win',
  PREDICTION_CORRECT = 'prediction_correct',
  REFERRAL = 'referral',
  CONTENT_CREATION = 'content_creation',
  COMMUNITY_ENGAGEMENT = 'community_engagement',
  SPECIAL_ACHIEVEMENT = 'special_achievement',
}

@Entity('nft_player_cards')
export class NFTPlayerCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_id', unique: true })
  @Index()
  tokenId: string; // The actual NFT token ID on Stellar/Soroban

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'contract_id' })
  contractId: string; // Soroban contract identifier

  @Column({ name: 'metadata_uri' })
  metadataUri: string; // IPFS/Arweave URI or centralized storage URL

  @Column({
    type: 'enum',
    enum: RewardType,
    name: 'reward_type',
  })
  @Index()
  rewardType: RewardType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional metadata about the NFT/achievement

  @Column({ name: 'transaction_hash' })
  transactionHash: string; // Stellar transaction hash for the mint

  @Column({ name: 'minted_at' })
  mintedAt: Date;

  @Column({ default: false, name: 'is_burned' })
  isBurned: boolean;

  @Column({ nullable: true, name: 'burned_at' })
  burnedAt: Date;

  @Column({ nullable: true, name: 'burn_transaction_hash' })
  burnTransactionHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
