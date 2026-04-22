import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { NFTMarketplaceService } from './nft-marketplace.service';
import {
  CreateListingDto,
  GetListingsQueryDto,
  BuyNFTDto,
  MakeOfferDto,
  RespondToOfferDto,
  CalculateFeesDto,
} from './dto/marketplace.dto';

@ApiTags('nft-marketplace')
@Controller('marketplace')
export class NFTMarketplaceController {
  constructor(private readonly marketplaceService: NFTMarketplaceService) {}

  // ─── Fee Calculator (public) ─────────────────────────────────────────────────

  @Get('fees')
  @ApiOperation({
    summary: 'Calculate marketplace fees for a given price',
    description:
      'Returns a breakdown of platform fee (2.5%), royalty fee (5%), total fees, and seller proceeds.',
  })
  @ApiResponse({ status: 200, description: 'Fee breakdown returned' })
  calculateFees(@Query() query: CalculateFeesDto) {
    const breakdown = this.marketplaceService.calculateFees(Number(query.price));
    return { data: breakdown };
  }

  // ─── Listings ─────────────────────────────────────────────────────────────────

  @Get('listings')
  @ApiOperation({ summary: 'Get paginated active NFT listings' })
  @ApiResponse({ status: 200, description: 'Paginated list of active listings' })
  async getActiveListings(@Query() query: GetListingsQueryDto) {
    const result = await this.marketplaceService.getActiveListings(query);
    return { data: result };
  }

  @Get('listings/:listingId')
  @ApiOperation({ summary: 'Get a single listing by ID' })
  @ApiParam({ name: 'listingId', description: 'UUID of the listing' })
  @ApiResponse({ status: 200, description: 'Listing details' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getListingById(
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    const listing = await this.marketplaceService.getListingById(listingId);
    return { data: listing };
  }

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a sell listing for an NFT you own' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 400, description: 'NFT already listed or validation error' })
  @ApiResponse({ status: 403, description: 'You do not own this NFT' })
  async createListing(
    @CurrentUser() user: User,
    @Body() dto: CreateListingDto,
  ) {
    const listing = await this.marketplaceService.createListing(user.id, dto);
    return {
      message: 'NFT listing created successfully',
      data: listing,
    };
  }

  @Delete('listings/:listingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an active listing (seller only)' })
  @ApiParam({ name: 'listingId', description: 'UUID of the listing to cancel' })
  @ApiResponse({ status: 200, description: 'Listing cancelled' })
  @ApiResponse({ status: 403, description: 'Not the seller' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async cancelListing(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    const listing = await this.marketplaceService.cancelListing(listingId, user.id);
    return {
      message: 'Listing cancelled successfully',
      data: listing,
    };
  }

  // ─── Buy NFT ──────────────────────────────────────────────────────────────────

  @Post('listings/:listingId/buy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buy an NFT at listed price',
    description:
      'Transfers ownership, deducts buyer wallet balance, and credits seller proceeds after fees.',
  })
  @ApiParam({ name: 'listingId', description: 'UUID of the listing to buy' })
  @ApiResponse({ status: 200, description: 'NFT purchased successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or listing not active' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async buyNFT(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: BuyNFTDto,
  ) {
    const listing = await this.marketplaceService.buyNFT(listingId, user.id);
    return {
      message: 'NFT purchased successfully',
      data: listing,
    };
  }

  // ─── Offers ───────────────────────────────────────────────────────────────────

  @Post('listings/:listingId/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Make an offer on a listing' })
  @ApiParam({ name: 'listingId', description: 'UUID of the listing' })
  @ApiResponse({ status: 201, description: 'Offer submitted successfully' })
  @ApiResponse({ status: 400, description: 'Offer below minimum or insufficient balance' })
  async makeOffer(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: MakeOfferDto,
  ) {
    const offer = await this.marketplaceService.makeOffer(listingId, user.id, dto);
    return {
      message: 'Offer submitted successfully',
      data: offer,
    };
  }

  @Get('listings/:listingId/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all offers for a listing (seller only)' })
  @ApiParam({ name: 'listingId', description: 'UUID of the listing' })
  @ApiResponse({ status: 200, description: 'List of offers' })
  @ApiResponse({ status: 403, description: 'Only the seller can view offers' })
  async getOffersForListing(
    @CurrentUser() user: User,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    const offers = await this.marketplaceService.getOffersForListing(listingId, user.id);
    return { data: offers };
  }

  @Post('offers/:offerId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer (seller only)' })
  @ApiParam({ name: 'offerId', description: 'UUID of the offer to accept' })
  @ApiResponse({ status: 200, description: 'Offer accepted, NFT transferred' })
  @ApiResponse({ status: 403, description: 'Only the listing seller can accept offers' })
  async acceptOffer(
    @CurrentUser() user: User,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    const offer = await this.marketplaceService.acceptOffer(offerId, user.id);
    return {
      message: 'Offer accepted and NFT transferred successfully',
      data: offer,
    };
  }

  @Post('offers/:offerId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an offer (seller only)' })
  @ApiParam({ name: 'offerId', description: 'UUID of the offer to reject' })
  @ApiResponse({ status: 200, description: 'Offer rejected' })
  @ApiResponse({ status: 403, description: 'Only the listing seller can reject offers' })
  async rejectOffer(
    @CurrentUser() user: User,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: RespondToOfferDto,
  ) {
    const offer = await this.marketplaceService.rejectOffer(offerId, user.id, dto.reason);
    return {
      message: 'Offer rejected',
      data: offer,
    };
  }

  @Delete('offers/:offerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw your own offer (buyer only)' })
  @ApiParam({ name: 'offerId', description: 'UUID of the offer to withdraw' })
  @ApiResponse({ status: 200, description: 'Offer withdrawn' })
  @ApiResponse({ status: 403, description: 'You can only withdraw your own offers' })
  async withdrawOffer(
    @CurrentUser() user: User,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    const offer = await this.marketplaceService.withdrawOffer(offerId, user.id);
    return {
      message: 'Offer withdrawn',
      data: offer,
    };
  }

  // ─── My Offers ────────────────────────────────────────────────────────────────

  @Get('my-offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all offers made by the current user' })
  @ApiResponse({ status: 200, description: 'User offer history' })
  async getMyOffers(@CurrentUser() user: User) {
    const offers = await this.marketplaceService.getMyOffers(user.id);
    return { data: offers };
  }
}
