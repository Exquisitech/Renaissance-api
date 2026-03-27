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
import { NFTListing } from './nft-listing.entity';

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

@Entity('nft_offers')
@Index(['listingId'])
@Index(['bidderId'])
@Index(['status'])
export class NFTOffer extends BaseEntity {
  @ApiProperty({ description: 'ID of the listing this offer is for' })
  @Column({ name: 'listing_id' })
  listingId: string;

  @ApiProperty({ description: 'ID of the user making the offer' })
  @Column({ name: 'bidder_id' })
  bidderId: string;

  @ApiProperty({ description: 'Offered price' })
  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @ApiProperty({ enum: OfferStatus, default: OfferStatus.PENDING })
  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.PENDING,
  })
  status: OfferStatus;

  @ApiPropertyOptional({ description: 'Offer expiry date' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Optional message from buyer' })
  @Column({ type: 'text', nullable: true })
  message?: string;

  @ApiPropertyOptional({ description: 'Transaction hash if offer was accepted and completed' })
  @Column({ name: 'transaction_hash', nullable: true })
  transactionHash?: string;

  /* Relations */

  @ManyToOne(() => NFTListing)
  @JoinColumn({ name: 'listing_id' })
  listing: NFTListing;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'bidder_id' })
  bidder: User;
}
