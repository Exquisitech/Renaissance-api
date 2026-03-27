import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFTMarketplaceController } from './nft-marketplace.controller';
import { NFTMarketplaceService } from './nft-marketplace.service';
import { NFTListing } from './entities/nft-listing.entity';
import { NFTOffer } from './entities/nft-offer.entity';
import { NFTPlayerCard } from './entities/nft.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NFTListing, NFTOffer, NFTPlayerCard, User]),
  ],
  controllers: [NFTMarketplaceController],
  providers: [NFTMarketplaceService],
  exports: [NFTMarketplaceService],
})
export class NFTMarketplaceModule {}
