import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { NFTPlayerCard } from './nft.entity';

export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('nft_listings')
@Index(['sellerId'])
@Index(['nftId'])
@Index(['status'])
@Index(['price'])
export class NFTListing extends BaseEntity {
  @ApiProperty({ description: 'ID of the NFT being listed' })
  @Column({ name: 'nft_id' })
  nftId: string;

  @ApiProperty({ description: 'ID of the seller' })
  @Column({ name: 'seller_id' })
  sellerId: string;

  @ApiProperty({ description: 'Listing price in platform currency' })
  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @ApiPropertyOptional({ description: 'Optional: minimum offer accepted' })
  @Column({
    name: 'min_offer_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  minOfferPrice?: number;

  @ApiProperty({ enum: ListingStatus, default: ListingStatus.ACTIVE })
  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.ACTIVE,
  })
  status: ListingStatus;

  @ApiPropertyOptional({ description: 'Optional expiry date for the listing' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'ID of the buyer once sold' })
  @Column({ name: 'buyer_id', nullable: true })
  buyerId?: string;

  @ApiPropertyOptional({ description: 'Blockchain transaction hash for the sale' })
  @Column({ name: 'sale_transaction_hash', nullable: true })
  saleTransactionHash?: string;

  @ApiPropertyOptional({ description: 'Platform fee charged (flat amount)' })
  @Column({
    name: 'platform_fee',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  platformFee?: number;

  @ApiPropertyOptional({ description: 'Royalty fee charged (flat amount)' })
  @Column({
    name: 'royalty_fee',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  royaltyFee?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  /* Relations */

  @ManyToOne(() => NFTPlayerCard)
  @JoinColumn({ name: 'nft_id' })
  nft: NFTPlayerCard;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer?: User;
}
