import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { NFTListing, ListingStatus } from './entities/nft-listing.entity';
import { NFTOffer, OfferStatus } from './entities/nft-offer.entity';
import { NFTPlayerCard } from './entities/nft.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateListingDto,
  GetListingsQueryDto,
  MakeOfferDto,
} from './dto/marketplace.dto';

export interface FeeBreakdown {
  price: number;
  platformFeeRate: number;
  platformFee: number;
  royaltyFeeRate: number;
  royaltyFee: number;
  totalFees: number;
  sellerProceeds: number;
}

export interface PaginatedListings {
  data: NFTListing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class NFTMarketplaceService {
  private readonly logger = new Logger(NFTMarketplaceService.name);

  /** Platform fee: 2.5% */
  private readonly PLATFORM_FEE_RATE = 0.025;
  /** Creator royalty: 5% */
  private readonly ROYALTY_FEE_RATE = 0.05;

  constructor(
    @InjectRepository(NFTListing)
    private readonly listingRepository: Repository<NFTListing>,
    @InjectRepository(NFTOffer)
    private readonly offerRepository: Repository<NFTOffer>,
    @InjectRepository(NFTPlayerCard)
    private readonly nftRepository: Repository<NFTPlayerCard>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Fee Calculator ───────────────────────────────────────────────────────────

  calculateFees(price: number): FeeBreakdown {
    const platformFee = +(price * this.PLATFORM_FEE_RATE).toFixed(8);
    const royaltyFee = +(price * this.ROYALTY_FEE_RATE).toFixed(8);
    const totalFees = +(platformFee + royaltyFee).toFixed(8);
    const sellerProceeds = +(price - totalFees).toFixed(8);

    return {
      price,
      platformFeeRate: this.PLATFORM_FEE_RATE,
      platformFee,
      royaltyFeeRate: this.ROYALTY_FEE_RATE,
      royaltyFee,
      totalFees,
      sellerProceeds,
    };
  }

  // ─── Create Listing ───────────────────────────────────────────────────────────

  async createListing(sellerId: string, dto: CreateListingDto): Promise<NFTListing> {
    // 1. Verify NFT exists and belongs to seller
    const nft = await this.nftRepository.findOne({ where: { id: dto.nftId } });
    if (!nft) {
      throw new NotFoundException(`NFT ${dto.nftId} not found`);
    }
    if (nft.userId !== sellerId) {
      throw new ForbiddenException('You do not own this NFT');
    }
    if (nft.isBurned) {
      throw new BadRequestException('Cannot list a burned NFT');
    }

    // 2. Check for existing active listing
    const existingListing = await this.listingRepository.findOne({
      where: { nftId: dto.nftId, status: ListingStatus.ACTIVE },
    });
    if (existingListing) {
      throw new BadRequestException('NFT is already listed for sale');
    }

    // 3. Pre-calculate fees
    const fees = this.calculateFees(dto.price);

    // 4. Persist listing
    const listing = this.listingRepository.create({
      nftId: dto.nftId,
      sellerId,
      price: dto.price,
      minOfferPrice: dto.minOfferPrice,
      status: ListingStatus.ACTIVE,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      platformFee: fees.platformFee,
      royaltyFee: fees.royaltyFee,
    });

    const saved = await this.listingRepository.save(listing);
    this.logger.log(`NFT ${dto.nftId} listed by user ${sellerId} at price ${dto.price}`);
    return saved;
  }

  // ─── Get Active Listings ──────────────────────────────────────────────────────

  async getActiveListings(query: GetListingsQueryDto): Promise<PaginatedListings> {
    const {
      sellerId,
      rewardType,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const qb = this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.nft', 'nft')
      .leftJoinAndSelect('listing.seller', 'seller')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere(
        '(listing.expires_at IS NULL OR listing.expires_at > NOW())',
      );

    if (sellerId) {
      qb.andWhere('listing.seller_id = :sellerId', { sellerId });
    }
    if (rewardType) {
      qb.andWhere('nft.reward_type = :rewardType', { rewardType });
    }
    if (minPrice !== undefined) {
      qb.andWhere('listing.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('listing.price <= :maxPrice', { maxPrice });
    }

    const sortColumn = sortBy === 'price' ? 'listing.price' : 'listing.created_at';
    qb.orderBy(sortColumn, sortOrder);

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Get Single Listing ───────────────────────────────────────────────────────

  async getListingById(listingId: string): Promise<NFTListing> {
    const listing = await this.listingRepository.findOne({
      where: { id: listingId },
      relations: ['nft', 'seller', 'buyer'],
    });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    return listing;
  }

  // ─── Buy NFT ──────────────────────────────────────────────────────────────────

  async buyNFT(listingId: string, buyerId: string): Promise<NFTListing> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the listing row to prevent concurrent purchases
      const listing = await queryRunner.manager.findOne(NFTListing, {
        where: { id: listingId, status: ListingStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
        relations: ['nft'],
      });

      if (!listing) {
        throw new NotFoundException(`Active listing ${listingId} not found`);
      }
      if (listing.sellerId === buyerId) {
        throw new BadRequestException('You cannot buy your own listing');
      }
      if (listing.expiresAt && listing.expiresAt < new Date()) {
        throw new BadRequestException('Listing has expired');
      }

      const buyer = await queryRunner.manager.findOne(User, { where: { id: buyerId } });
      if (!buyer) {
        throw new NotFoundException('Buyer not found');
      }
      if (Number(buyer.walletBalance) < listing.price) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const fees = this.calculateFees(listing.price);

      // Debit buyer
      buyer.walletBalance = +(Number(buyer.walletBalance) - listing.price).toFixed(8);
      await queryRunner.manager.save(buyer);

      // Credit seller (minus fees)
      const seller = await queryRunner.manager.findOne(User, { where: { id: listing.sellerId } });
      if (seller) {
        seller.walletBalance = +(Number(seller.walletBalance) + fees.sellerProceeds).toFixed(8);
        await queryRunner.manager.save(seller);
      }

      // Transfer NFT ownership
      const nft = await queryRunner.manager.findOne(NFTPlayerCard, { where: { id: listing.nftId } });
      if (nft) {
        nft.userId = buyerId;
        await queryRunner.manager.save(nft);
      }

      // Update listing
      listing.status = ListingStatus.SOLD;
      listing.buyerId = buyerId;
      listing.platformFee = fees.platformFee;
      listing.royaltyFee = fees.royaltyFee;
      await queryRunner.manager.save(listing);

      // Expire all pending offers for this listing
      await queryRunner.manager
        .createQueryBuilder()
        .update(NFTOffer)
        .set({ status: OfferStatus.EXPIRED })
        .where('listing_id = :listingId AND status = :status', {
          listingId,
          status: OfferStatus.PENDING,
        })
        .execute();

      await queryRunner.commitTransaction();

      this.logger.log(`NFT listing ${listingId} purchased by user ${buyerId}`);
      return listing;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Buy NFT failed for listing ${listingId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Cancel Listing ───────────────────────────────────────────────────────────

  async cancelListing(listingId: string, userId: string): Promise<NFTListing> {
    const listing = await this.listingRepository.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('Only the seller can cancel this listing');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be cancelled');
    }

    listing.status = ListingStatus.CANCELLED;
    const saved = await this.listingRepository.save(listing);

    // Expire all pending offers
    await this.offerRepository
      .createQueryBuilder()
      .update()
      .set({ status: OfferStatus.EXPIRED })
      .where('listing_id = :listingId AND status = :status', {
        listingId,
        status: OfferStatus.PENDING,
      })
      .execute();

    this.logger.log(`Listing ${listingId} cancelled by seller ${userId}`);
    return saved;
  }

  // ─── Make Offer ───────────────────────────────────────────────────────────────

  async makeOffer(listingId: string, bidderId: string, dto: MakeOfferDto): Promise<NFTOffer> {
    const listing = await this.listingRepository.findOne({
      where: { id: listingId, status: ListingStatus.ACTIVE },
    });
    if (!listing) {
      throw new NotFoundException(`Active listing ${listingId} not found`);
    }
    if (listing.sellerId === bidderId) {
      throw new BadRequestException('You cannot make an offer on your own listing');
    }
    if (listing.expiresAt && listing.expiresAt < new Date()) {
      throw new BadRequestException('Listing has expired');
    }
    if (listing.minOfferPrice && dto.amount < listing.minOfferPrice) {
      throw new BadRequestException(
        `Offer amount must be at least ${listing.minOfferPrice}`,
      );
    }

    // Check bidder balance
    const bidder = await this.userRepository.findOne({ where: { id: bidderId } });
    if (!bidder) {
      throw new NotFoundException('Bidder not found');
    }
    if (Number(bidder.walletBalance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance to make this offer');
    }

    const offer = this.offerRepository.create({
      listingId,
      bidderId,
      amount: dto.amount,
      message: dto.message,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      status: OfferStatus.PENDING,
    });

    const saved = await this.offerRepository.save(offer);
    this.logger.log(`Offer ${saved.id} made on listing ${listingId} by user ${bidderId}`);
    return saved;
  }

  // ─── Get Offers for Listing ───────────────────────────────────────────────────

  async getOffersForListing(listingId: string, sellerId: string): Promise<NFTOffer[]> {
    const listing = await this.listingRepository.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('Only the seller can view offers for this listing');
    }

    return this.offerRepository.find({
      where: { listingId },
      relations: ['bidder'],
      order: { amount: 'DESC', createdAt: 'ASC' },
    });
  }

  // ─── Accept Offer ─────────────────────────────────────────────────────────────

  async acceptOffer(offerId: string, sellerId: string): Promise<NFTOffer> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const offer = await queryRunner.manager.findOne(NFTOffer, {
        where: { id: offerId, status: OfferStatus.PENDING },
        lock: { mode: 'pessimistic_write' },
        relations: ['listing'],
      });
      if (!offer) {
        throw new NotFoundException(`Pending offer ${offerId} not found`);
      }

      const listing = offer.listing;
      if (!listing || listing.sellerId !== sellerId) {
        throw new ForbiddenException('Only the listing seller can accept offers');
      }
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException('Listing is no longer active');
      }
      if (offer.expiresAt && offer.expiresAt < new Date()) {
        throw new BadRequestException('This offer has expired');
      }

      const fees = this.calculateFees(offer.amount);

      // Debit buyer (bidder)
      const buyer = await queryRunner.manager.findOne(User, { where: { id: offer.bidderId } });
      if (!buyer) {
        throw new NotFoundException('Offer bidder not found');
      }
      if (Number(buyer.walletBalance) < offer.amount) {
        throw new BadRequestException('Bidder has insufficient balance');
      }
      buyer.walletBalance = +(Number(buyer.walletBalance) - offer.amount).toFixed(8);
      await queryRunner.manager.save(buyer);

      // Credit seller
      const seller = await queryRunner.manager.findOne(User, { where: { id: sellerId } });
      if (seller) {
        seller.walletBalance = +(Number(seller.walletBalance) + fees.sellerProceeds).toFixed(8);
        await queryRunner.manager.save(seller);
      }

      // Transfer NFT ownership
      const nft = await queryRunner.manager.findOne(NFTPlayerCard, { where: { id: listing.nftId } });
      if (nft) {
        nft.userId = offer.bidderId;
        await queryRunner.manager.save(nft);
      }

      // Update listing → SOLD
      listing.status = ListingStatus.SOLD;
      listing.buyerId = offer.bidderId;
      listing.platformFee = fees.platformFee;
      listing.royaltyFee = fees.royaltyFee;
      await queryRunner.manager.save(listing);

      // Accept the winning offer
      offer.status = OfferStatus.ACCEPTED;
      await queryRunner.manager.save(offer);

      // Reject all other pending offers for the listing
      await queryRunner.manager
        .createQueryBuilder()
        .update(NFTOffer)
        .set({ status: OfferStatus.REJECTED })
        .where('listing_id = :listingId AND status = :status AND id != :offerId', {
          listingId: listing.id,
          status: OfferStatus.PENDING,
          offerId,
        })
        .execute();

      await queryRunner.commitTransaction();

      this.logger.log(`Offer ${offerId} accepted for listing ${listing.id}`);
      return offer;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Accept offer failed for ${offerId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Reject Offer ─────────────────────────────────────────────────────────────

  async rejectOffer(offerId: string, sellerId: string, reason?: string): Promise<NFTOffer> {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId, status: OfferStatus.PENDING },
      relations: ['listing'],
    });
    if (!offer) {
      throw new NotFoundException(`Pending offer ${offerId} not found`);
    }
    if (!offer.listing || offer.listing.sellerId !== sellerId) {
      throw new ForbiddenException('Only the listing seller can reject offers');
    }

    offer.status = OfferStatus.REJECTED;
    if (reason) {
      offer.message = reason;
    }
    const saved = await this.offerRepository.save(offer);
    this.logger.log(`Offer ${offerId} rejected by seller ${sellerId}`);
    return saved;
  }

  // ─── Withdraw Offer ───────────────────────────────────────────────────────────

  async withdrawOffer(offerId: string, bidderId: string): Promise<NFTOffer> {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId, status: OfferStatus.PENDING },
    });
    if (!offer) {
      throw new NotFoundException(`Pending offer ${offerId} not found`);
    }
    if (offer.bidderId !== bidderId) {
      throw new ForbiddenException('You can only withdraw your own offers');
    }

    offer.status = OfferStatus.WITHDRAWN;
    return this.offerRepository.save(offer);
  }

  // ─── Get My Offers ────────────────────────────────────────────────────────────

  async getMyOffers(bidderId: string): Promise<NFTOffer[]> {
    return this.offerRepository.find({
      where: { bidderId },
      relations: ['listing', 'listing.nft'],
      order: { createdAt: 'DESC' },
    });
  }
}
