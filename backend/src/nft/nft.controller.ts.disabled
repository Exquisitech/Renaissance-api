import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger 
} from '@nestjs/common';
import { NFTService, MintNFTOptions } from './nft.service';
import { NFTPlayerCard, RewardType } from './nft.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { User } from 'src/users/entities/user.entity';
export class MintNFTDto {
  rewardType: RewardType;
  playerId?: string;
  matchId?: string;
  value?: number;
  metadata?: Record<string, any>;
}

export class BatchMintNFTDto {
  mints: MintNFTDto[];
}

@ApiTags('nft')
@Controller('nft')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NFTController {
  private readonly logger = new Logger(NFTController.name);

  constructor(private readonly nftService: NFTService) {}

  @Post('mint')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mint a new NFT for the current user' })
  @ApiResponse({ status: 201, description: 'NFT minted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async mintNFT(
    @CurrentUser() user: User,
    @Body() mintDto: MintNFTDto,
  ) {
    try {
      const result = await this.nftService.mintNFTForReward({
        userId: user.id,
        rewardType: mintDto.rewardType,
        playerId: mintDto.playerId,
        matchId: mintDto.matchId,
        value: mintDto.value,
        metadata: mintDto.metadata,
      });

      if (!result.success) {
        throw new BadRequestException(result.error);
      }

      return {
        message: 'NFT minted successfully',
        data: {
          tokenId: result.tokenId,
          transactionHash: result.transactionHash,
          nft: result.nftCard,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to mint NFT: ${error.message}`);
      throw error;
    }
  }

  @Post('mint/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Batch mint multiple NFTs for the current user' })
  async batchMintNFTs(
    @CurrentUser() user: User,
    @Body() batchDto: BatchMintNFTDto,
  ) {
    const mintOptions: MintNFTOptions[] = batchDto.mints.map(mint => ({
      userId: user.id,
      rewardType: mint.rewardType,
      playerId: mint.playerId,
      matchId: mint.matchId,
      value: mint.value,
      metadata: mint.metadata,
    }));

    const results = await this.nftService.batchMintNFTs(mintOptions);

    return {
      message: 'Batch minting completed',
      data: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    };
  }

  @Get('my-nfts')
  @ApiOperation({ summary: 'Get all NFTs for the current user' })
  async getMyNFTs(@CurrentUser() user: User): Promise<NFTPlayerCard[]> {
    return this.nftService.getUserNFTs(user.id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all NFTs for a specific user' })
  async getUserNFTs(@Param('userId') userId: string): Promise<NFTPlayerCard[]> {
    return this.nftService.getUserNFTs(userId);
  }

  @Get('token/:tokenId')
  @ApiOperation({ summary: 'Get NFT by token ID' })
  async getNFTByTokenId(@Param('tokenId') tokenId: string): Promise<NFTPlayerCard> {
    const nft = await this.nftService.getNFTByTokenId(tokenId);
    if (!nft) {
      throw new BadRequestException(`NFT with token ID ${tokenId} not found`);
    }
    return nft;
  }

  @Get('reward-type/:rewardType')
  @ApiOperation({ summary: 'Get NFTs by reward type' })
  async getNFTsByRewardType(@Param('rewardType') rewardType: RewardType): Promise<NFTPlayerCard[]> {
    return this.nftService.getNFTsByRewardType(rewardType);
  }

  @Get('check/:rewardType')
  @ApiOperation({ summary: 'Check if user has a specific reward type NFT' })
  async checkUserHasRewardType(
    @CurrentUser() user: User,
    @Param('rewardType') rewardType: RewardType,
  ): Promise<{ hasNFT: boolean }> {
    const hasNFT = await this.nftService.userHasNFTRewardType(user.id, rewardType);
    return { hasNFT };
  }

  @Post('burn/:tokenId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Burn an NFT' })
  async burnNFT(
    @CurrentUser() user: User,
    @Param('tokenId') tokenId: string,
  ) {
    // Verify ownership before burning
    const nft = await this.nftService.getNFTByTokenId(tokenId);
    if (!nft || nft.userId !== user.id) {
      throw new BadRequestException('NFT not found or not owned by user');
    }

    const success = await this.nftService.burnNFT(tokenId);
    
    if (!success) {
      throw new BadRequestException('Failed to burn NFT');
    }

    return { message: 'NFT burned successfully' };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get NFT statistics for current user' })
  async getUserNFTStats(@CurrentUser() user: User) {
    const nfts = await this.nftService.getUserNFTs(user.id);
    
    const stats = {
      total: nfts.length,
      byRewardType: {} as Record<RewardType, number>,
      byRarity: {} as Record<string, number>,
      recent: nfts.slice(0, 5),
    };

    nfts.forEach(nft => {
      // Count by reward type
      stats.byRewardType[nft.rewardType] = (stats.byRewardType[nft.rewardType] || 0) + 1;
      
      // Count by rarity (if exists in metadata)
      const rarity = nft.metadata?.attributes?.find(attr => attr.trait_type === 'Rarity')?.value;
      if (rarity) {
        stats.byRarity[rarity] = (stats.byRarity[rarity] || 0) + 1;
      }
    });

    return stats;
  }
}