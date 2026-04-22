import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/** POST /marketplace/listings */
export class CreateListingDto {
  @ApiProperty({ description: 'UUID of the NFT to list for sale' })
  @IsUUID()
  nftId: string;

  @ApiProperty({ description: 'Listing price', example: 100 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    description: 'Minimum offer price (below this, offers are auto-rejected)',
    example: 80,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  minOfferPrice?: number;

  @ApiPropertyOptional({
    description: 'ISO 8601 expiry date for the listing',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/** GET /marketplace/listings query params */
export class GetListingsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by seller user ID' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Filter by NFT reward type' })
  @IsOptional()
  @IsString()
  rewardType?: string;

  @ApiPropertyOptional({ description: 'Minimum price filter' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price filter' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Page number (default: 1)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size (default: 20)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort field: price | createdAt',
    example: 'price',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'price' | 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order: ASC | DESC',
    example: 'ASC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

/** POST /marketplace/listings/:listingId/buy */
export class BuyNFTDto {
  @ApiPropertyOptional({ description: 'Optional buyer notes / memo' })
  @IsOptional()
  @IsString()
  memo?: string;
}

/** POST /marketplace/listings/:listingId/offers */
export class MakeOfferDto {
  @ApiProperty({ description: 'Offer amount', example: 90 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Optional message to the seller',
    example: 'I love this card, would love to buy it!',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 offer expiry date',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/** POST /marketplace/offers/:offerId/accept|reject */
export class RespondToOfferDto {
  @ApiPropertyOptional({ description: 'Optional reason when rejecting' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/** GET /marketplace/fees query params */
export class CalculateFeesDto {
  @ApiProperty({ description: 'Price to calculate fees for', example: 100 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;
}
