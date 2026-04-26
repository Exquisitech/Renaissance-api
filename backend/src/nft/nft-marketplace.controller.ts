import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ParseFloatPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NFTMarketplaceService, ListingsFilter } from './nft-marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { MakeOfferDto } from './dto/make-offer.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  NFTListingResponseDto,
  NFTOfferResponseDto,
  NFTPlayerCardResponseDto,
  PaginatedListingsDto,
  PaginatedNFTsDto,
} from './dto/nft-response.dto';
import { ListingStatus } from './entities/nft-listing.entity';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'NFT already listed',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string;
}

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags('NFT Marketplace')
@Controller('nft')
export class NFTMarketplaceController {
  constructor(private readonly nftMarketplaceService: NFTMarketplaceService) {}

  // ==================== LISTINGS ====================

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'List an NFT for sale',
    description:
      'Lists a player card NFT on the marketplace for sale. The NFT must be owned by the user and not already listed.',
  })
  @ApiBody({ type: CreateListingDto })
  @ApiResponse({
    status: 201,
    description: 'NFT successfully listed for sale',
    type: NFTListingResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        nftCardId: '550e8400-e29b-41d4-a716-446655440000',
        sellerId: '456e7890-e12b-34d5-a678-901234567890',
        sellerUsername: 'john_doe',
        price: 100.5,
        currency: 'XLM',
        status: 'active',
        expiresAt: '2026-05-23T12:00:00Z',
        blockchainTxHash: 'GA2U...',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or NFT not owned',
    schema: {
      example: {
        statusCode: 400,
        message: 'NFT already listed or insufficient permissions',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'NFT player card not found',
  })
  @ApiResponse({
    status: 409,
    description: 'NFT already listed',
    schema: {
      example: {
        statusCode: 409,
        message: 'This NFT is already listed',
        error: 'Conflict',
      },
    },
  })
  async createListing(
    @Req() req: AuthenticatedRequest,
    @Body() createListingDto: CreateListingDto,
  ) {
    const listing = await this.nftMarketplaceService.listNFT(
      req.user.userId,
      createListingDto,
    );
    return this.mapListingToResponse(listing);
  }

  @Get('listings')
  @ApiOperation({
    summary: 'Browse all active listings',
    description:
      'Retrieves a paginated list of active NFT listings with optional filtering by price range and currency',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Filter by currency (XLM, USDC, etc.)',
    example: 'XLM',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: Number,
    description: 'Minimum price filter',
    example: 10.0,
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: Number,
    description: 'Maximum price filter',
    example: 1000.0,
  })
  @ApiResponse({
    status: 200,
    description: 'Active listings retrieved successfully',
    type: PaginatedListingsDto,
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            nftCardId: '550e8400-e29b-41d4-a716-446655440000',
            sellerId: '456e7890-e12b-34d5-a678-901234567890',
            sellerUsername: 'john_doe',
            price: 100.5,
            currency: 'XLM',
            status: 'active',
            expiresAt: '2026-05-23T12:00:00Z',
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
        total: 250,
        page: 1,
        limit: 10,
        totalPages: 25,
      },
    },
  })
  async getListings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('currency') currency?: string,
    @Query('minPrice', ParseFloatPipe) minPrice?: number,
    @Query('maxPrice', ParseFloatPipe) maxPrice?: number,
  ) {
    const filter: ListingsFilter = {
      status: ListingStatus.ACTIVE,
      currency,
      minPrice,
      maxPrice,
      page,
      limit,
    };

    const result = await this.nftMarketplaceService.getListings(filter);
    return {
      ...result,
      data: result.data.map((listing) => this.mapListingToResponse(listing)),
    };
  }

  @Get('listings/:id')
  @ApiOperation({
    summary: 'Get listing details with offers',
    description: 'Retrieves detailed information about a listing including all offers made',
  })
  @ApiParam({
    name: 'id',
    description: 'Listing UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Listing details retrieved',
    type: NFTListingResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        nftCardId: '550e8400-e29b-41d4-a716-446655440000',
        sellerId: '456e7890-e12b-34d5-a678-901234567890',
        sellerUsername: 'john_doe',
        price: 100.5,
        currency: 'XLM',
        status: 'active',
        expiresAt: '2026-05-23T12:00:00Z',
        offers: [
          {
            id: 'offer_123',
            buyerId: '567e8901-e23c-45e6-b789-012345678901',
            buyerUsername: 'jane_doe',
            offerPrice: 95.0,
            currency: 'XLM',
            status: 'pending',
            expiresAt: '2024-02-15T12:00:00Z',
            createdAt: '2024-01-16T10:00:00Z',
          },
        ],
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Listing not found',
  })
  async getListingById(@Param('id') id: string) {
    const listing = await this.nftMarketplaceService.getListingById(id);
    return this.mapListingToResponse(listing);
  }

  @Patch('listings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update listing price or expiration',
    description:
      'Updates the price and/or expiration date of an active listing. Only the seller can update.',
  })
  @ApiParam({
    name: 'id',
    description: 'Listing UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateListingDto })
  @ApiResponse({
    status: 200,
    description: 'Listing updated successfully',
    type: NFTListingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid price or expired listing',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only seller can update listing',
  })
  @ApiResponse({
    status: 404,
    description: 'Listing not found',
  })
  async updateListing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
  ) {
    const listing = await this.nftMarketplaceService.updateListing(
      req.user.userId,
      id,
      updateListingDto,
    );
    return this.mapListingToResponse(listing);
  }

  @Delete('listings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a listing',
    description: 'Cancels an active listing and returns the NFT to the sellers inventory. Only seller can cancel.',
  })
  @ApiParam({
    name: 'id',
    description: 'Listing UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Listing cancelled successfully',
    type: NFTListingResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'cancelled',
        message: 'Listing cancelled',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - listing already sold or expired',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only seller can cancel listing',
  })
  @ApiResponse({
    status: 404,
    description: 'Listing not found',
  })
  async cancelListing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const listing = await this.nftMarketplaceService.cancelListing(
      req.user.userId,
      id,
    );
    return this.mapListingToResponse(listing);
  }

  @Post('listings/:id/purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Purchase NFT at listing price',
    description:
      'Purchases an NFT at the listed price. Transfers ownership and records the transaction on the blockchain.',
  })
  @ApiParam({
    name: 'id',
    description: 'Listing UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'NFT purchased successfully',
    type: NFTListingResponseDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        nftCardId: '550e8400-e29b-41d4-a716-446655440000',
        sellerId: '456e7890-e12b-34d5-a678-901234567890',
        buyerId: '567e8901-e23c-45e6-b789-012345678901',
        price: 100.5,
        currency: 'XLM',
        status: 'sold',
        soldAt: '2024-01-15T11:00:00Z',
        blockchainTxHash: 'GA2U...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - insufficient balance or NFT not available',
    schema: {
      example: {
        statusCode: 400,
        message: 'Insufficient balance to purchase NFT',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Listing not found or NFT unavailable',
  })
  async purchaseNFT(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const listing = await this.nftMarketplaceService.purchaseNFT(
      req.user.userId,
      id,
    );
    return this.mapListingToResponse(listing);
  }

  @Post('listings/:id/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Make an offer on a listing',
    description:
      'Makes an offer to purchase an NFT at a negotiated price. The seller can accept, reject, or counter the offer.',
  })
  @ApiParam({
    name: 'id',
    description: 'Listing UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: MakeOfferDto })
  @ApiResponse({
    status: 201,
    description: 'Offer created successfully',
    type: NFTOfferResponseDto,
    schema: {
      example: {
        id: 'offer_123',
        listingId: '123e4567-e89b-12d3-a456-426614174000',
        buyerId: '567e8901-e23c-45e6-b789-012345678901',
        buyerUsername: 'jane_doe',
        offerPrice: 95.0,
        currency: 'XLM',
        status: 'pending',
        expiresAt: '2024-02-15T12:00:00Z',
        createdAt: '2024-01-16T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - offer below minimum or invalid data',
    schema: {
      example: {
        statusCode: 400,
        message: 'Offer cannot exceed listed price',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Listing not found',
  })
  async makeOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() makeOfferDto: MakeOfferDto,
  ) {
    const offer = await this.nftMarketplaceService.makeOffer(
      req.user.userId,
      id,
      makeOfferDto,
    );
    return this.mapOfferToResponse(offer);
  }

  // ==================== OFFERS ====================

  @Post('offers/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an offer',
    description:
      'Accepts a buyer offer and completes the NFT transfer. Only the seller can accept offers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer UUID',
    example: 'offer_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer accepted successfully',
    type: NFTOfferResponseDto,
    schema: {
      example: {
        id: 'offer_123',
        listingId: '123e4567-e89b-12d3-a456-426614174000',
        buyerId: '567e8901-e23c-45e6-b789-012345678901',
        offerPrice: 95.0,
        currency: 'XLM',
        status: 'accepted',
        respondedAt: '2024-01-16T14:00:00Z',
        createdAt: '2024-01-16T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - offer cannot be accepted (expired or invalid)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only seller can accept offer',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
  })
  async acceptOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const offer = await this.nftMarketplaceService.acceptOffer(
      req.user.userId,
      id,
    );
    return this.mapOfferToResponse(offer);
  }

  @Post('offers/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject an offer',
    description:
      'Rejects a buyer offer. Only the seller can reject offers. The buyer is notified of the rejection.',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer UUID',
    example: 'offer_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer rejected successfully',
    type: NFTOfferResponseDto,
    schema: {
      example: {
        id: 'offer_123',
        status: 'rejected',
        respondedAt: '2024-01-16T14:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - offer already responded to',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only seller can reject offer',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
  })
  async rejectOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const offer = await this.nftMarketplaceService.rejectOffer(
      req.user.userId,
      id,
    );
    return this.mapOfferToResponse(offer);
  }

  @Delete('offers/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an offer',
    description:
      'Cancels a pending offer made by the authenticated user. Can only cancel own offers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer UUID',
    example: 'offer_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer cancelled successfully',
    type: NFTOfferResponseDto,
    schema: {
      example: {
        id: 'offer_123',
        status: 'cancelled',
        message: 'Offer cancelled',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - offer already accepted or rejected',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only cancel own offers',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
  })
  async cancelOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const offer = await this.nftMarketplaceService.cancelOffer(
      req.user.userId,
      id,
    );
    return this.mapOfferToResponse(offer);
  }

  // ==================== USER-SPECIFIC ENDPOINTS ====================

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get authenticated user's listings",
    description: 'Retrieves all listings created by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: "User's listings retrieved",
    type: [NFTListingResponseDto],
  })
  async getMyListings(@Req() req: AuthenticatedRequest) {
    const listings = await this.nftMarketplaceService.getUserListings(
      req.user.userId,
    );
    return listings.map((listing) => this.mapListingToResponse(listing));
  }

  @Get('my-offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get authenticated user's offers",
    description: 'Retrieves all offers made by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: "User's offers retrieved",
    type: [NFTOfferResponseDto],
  })
  async getMyOffers(@Req() req: AuthenticatedRequest) {
    const offers = await this.nftMarketplaceService.getUserOffers(
      req.user.userId,
    );
    return offers.map((offer) => this.mapOfferToResponse(offer));
  }

  @Get('my-nfts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get authenticated user's owned NFTs",
    description:
      'Retrieves all NFTs owned by the authenticated user, regardless of listing status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "User's owned NFTs retrieved",
    type: PaginatedNFTsDto,
  })
  async getMyNFTs(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.nftMarketplaceService.getUserOwnedNFTs(
      req.user.userId,
      page,
      limit,
    );
    return {
      ...result,
      data: result.data.map((nft) => this.mapNFTCardToResponse(nft)),
    };
  }

  // ==================== HELPER METHODS ====================

  private mapListingToResponse(listing: any): NFTListingResponseDto {
    return {
      id: listing.id,
      nftCardId: listing.nftCardId,
      sellerId: listing.sellerId,
      sellerUsername: listing.seller?.username || 'Unknown',
      price: Number(listing.price),
      currency: listing.currency,
      status: listing.status,
      expiresAt: listing.expiresAt,
      blockchainTxHash: listing.blockchainTxHash,
      soldAt: listing.soldAt,
      buyerId: listing.buyerId,
      buyerUsername: listing.buyer?.username,
      offers: listing.offers?.map((offer: any) => this.mapOfferToResponse(offer)),
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  private mapOfferToResponse(offer: any): NFTOfferResponseDto {
    return {
      id: offer.id,
      listingId: offer.listingId,
      buyerId: offer.buyerId,
      buyerUsername: offer.buyer?.username || 'Unknown',
      offerPrice: Number(offer.offerPrice),
      currency: offer.currency,
      status: offer.status,
      expiresAt: offer.expiresAt,
      respondedAt: offer.respondedAt,
      createdAt: offer.createdAt,
    };
  }

  private mapNFTCardToResponse(nftCard: any): NFTPlayerCardResponseDto {
    return {
      id: nftCard.id,
      ownerId: nftCard.ownerId,
      ownerUsername: nftCard.owner?.username || 'Unknown',
      contractAddress: nftCard.contractAddress,
      tokenId: nftCard.tokenId,
      acquiredAt: nftCard.acquiredAt,
      acquisitionPrice: nftCard.acquisitionPrice
        ? Number(nftCard.acquisitionPrice)
        : undefined,
      isListed: nftCard.isListed,
      metadata: nftCard.metadata,
      createdAt: nftCard.createdAt,
    };
  }
}
