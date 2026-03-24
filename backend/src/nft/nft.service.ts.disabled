import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NFTPlayerCard, RewardType } from './nft.entity';
import { User } from 'src/users/entities/user.entity';
import { StellarService } from '../stellar/stellar.service'; // Assuming you have this
import { SorobanService } from '../soroban/soroban.service'; // Assuming you have this
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface MintNFTOptions {
  userId: string;
  rewardType: RewardType;
  metadata?: Record<string, any>;
  playerId?: string; // Optional player identifier for player-specific cards
  matchId?: string; // Optional match identifier
  value?: number; // Optional value/rarity score
}

export interface MintNFTResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  nftCard?: NFTPlayerCard;
  error?: string;
}

@Injectable()
export class NFTService {
  private readonly logger = new Logger(NFTService.name);
  private readonly nftContractId: string;

  constructor(
    @InjectRepository(NFTPlayerCard)
    private nftRepository: Repository<NFTPlayerCard>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private stellarService: StellarService,
    private sorobanService: SorobanService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    this.nftContractId = this.configService.get<string>('SOROBAN_NFT_CONTRACT_ID');
  }

  /**
   * Main method to trigger NFT minting when a reward is earned
   */
  async mintNFTForReward(options: MintNFTOptions): Promise<MintNFTResult> {
    const { userId, rewardType, metadata = {}, playerId, matchId, value } = options;
    
    this.logger.log(`Initiating NFT mint for user ${userId}, reward type: ${rewardType}`);

    // Start a database transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException(`User with ID ${userId} not found`);
      }

      // 2. Generate metadata URI (IPFS or centralized storage)
      const metadataUri = await this.generateMetadataUri({
        userId,
        rewardType,
        playerId,
        matchId,
        value,
        ...metadata
      });

      // 3. Prepare Soroban contract parameters
      const mintParams = {
        recipient: user.walletAddress, // Assuming user has walletAddress field
        metadataUri,
        rewardType,
        timestamp: new Date().toISOString(),
        value: value || this.getDefaultValueForRewardType(rewardType),
      };

      // 4. Call Soroban contract to mint NFT
      const mintResult = await this.sorobanService.mintNFT(
        this.nftContractId,
        mintParams
      );

      if (!mintResult.success) {
        throw new Error(`Soroban minting failed: ${mintResult.error}`);
      }

      // 5. Create NFT record in database
      const nftCard = this.nftRepository.create({
        tokenId: mintResult.tokenId,
        userId: user.id,
        contractId: this.nftContractId,
        metadataUri,
        rewardType,
        metadata: {
          ...metadata,
          playerId,
          matchId,
          value: value || this.getDefaultValueForRewardType(rewardType),
          mintedAt: new Date().toISOString(),
        },
        transactionHash: mintResult.transactionHash,
        mintedAt: new Date(),
      });

      await queryRunner.manager.save(nftCard);

      // 6. Create audit trail entry
      await this.createAuditTrail(queryRunner, {
        userId: user.id,
        action: 'NFT_MINTED',
        tokenId: mintResult.tokenId,
        rewardType,
        transactionHash: mintResult.transactionHash,
        metadata: nftCard.metadata,
      });

      // Commit transaction
      await queryRunner.commitTransaction();

      this.logger.log(`Successfully minted NFT ${mintResult.tokenId} for user ${userId}`);

      return {
        success: true,
        tokenId: mintResult.tokenId,
        transactionHash: mintResult.transactionHash,
        nftCard,
      };

    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      
      this.logger.error(`Failed to mint NFT for user ${userId}: ${error.message}`, error.stack);
      
      // Create audit trail for failure
      await this.createAuditTrail(null, {
        userId: options.userId,
        action: 'NFT_MINT_FAILED',
        rewardType: options.rewardType,
        error: error.message,
        metadata: options.metadata,
      }).catch(e => this.logger.error('Failed to create audit trail', e));

      return {
        success: false,
        error: error.message,
      };

    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Mint multiple NFTs for a user (batch rewards)
   */
  async batchMintNFTs(options: MintNFTOptions[]): Promise<MintNFTResult[]> {
    const results: MintNFTResult[] = [];
    
    for (const option of options) {
      try {
        const result = await this.mintNFTForReward(option);
        results.push(result);
        
        // Add small delay to avoid rate limiting
        await this.delay(500);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  /**
   * Get all NFTs for a user
   */
  async getUserNFTs(userId: string): Promise<NFTPlayerCard[]> {
    return this.nftRepository.find({
      where: { userId, isBurned: false },
      order: { mintedAt: 'DESC' },
    });
  }

  /**
   * Get NFT by token ID
   */
  async getNFTByTokenId(tokenId: string): Promise<NFTPlayerCard> {
    return this.nftRepository.findOne({ 
      where: { tokenId },
      relations: ['user'],
    });
  }

  /**
   * Get NFTs by reward type
   */
  async getNFTsByRewardType(rewardType: RewardType): Promise<NFTPlayerCard[]> {
    return this.nftRepository.find({
      where: { rewardType, isBurned: false },
      order: { mintedAt: 'DESC' },
    });
  }

  /**
   * Check if user has a specific type of NFT
   */
  async userHasNFTRewardType(userId: string, rewardType: RewardType): Promise<boolean> {
    const count = await this.nftRepository.count({
      where: { userId, rewardType, isBurned: false },
    });
    return count > 0;
  }

  /**
   * Burn an NFT (if needed)
   */
  async burnNFT(tokenId: string): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nft = await this.nftRepository.findOne({ where: { tokenId } });
      if (!nft) {
        throw new BadRequestException(`NFT with token ID ${tokenId} not found`);
      }

      // Call Soroban contract to burn
      const burnResult = await this.sorobanService.burnNFT(this.nftContractId, tokenId);
      
      if (!burnResult.success) {
        throw new Error(`Soroban burning failed: ${burnResult.error}`);
      }

      // Update database record
      nft.isBurned = true;
      nft.burnedAt = new Date();
      nft.burnTransactionHash = burnResult.transactionHash;
      
      await queryRunner.manager.save(nft);
      
      // Create audit trail
      await this.createAuditTrail(queryRunner, {
        userId: nft.userId,
        action: 'NFT_BURNED',
        tokenId,
        transactionHash: burnResult.transactionHash,
      });

      await queryRunner.commitTransaction();
      
      return true;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to burn NFT ${tokenId}: ${error.message}`);
      return false;

    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate metadata URI (IPFS or centralized)
   */
  private async generateMetadataUri(data: any): Promise<string> {
    // In production, you'd upload this to IPFS/Arweave
    // For now, we'll create a structured metadata object
    
    const metadata = {
      name: this.generateNFTName(data.rewardType, data.playerId),
      description: this.generateNFTDescription(data.rewardType, data),
      image: this.getNFTImageUrl(data.rewardType, data.playerId),
      attributes: [
        {
          trait_type: 'Reward Type',
          value: data.rewardType,
        },
        {
          trait_type: 'Value',
          value: data.value || this.getDefaultValueForRewardType(data.rewardType),
        },
        {
          trait_type: 'Rarity',
          value: this.calculateRarity(data.value || 0),
        },
      ],
      external_url: `https://renaissance.football/nft/${data.userId}/${Date.now()}`,
    };

    if (data.playerId) {
      metadata.attributes.push({
        trait_type: 'Player',
        value: data.playerId,
      });
    }

    if (data.matchId) {
      metadata.attributes.push({
        trait_type: 'Match',
        value: data.matchId,
      });
    }

    // In development, return a mock URI
    if (process.env.NODE_ENV === 'development') {
      return `https://api.renaissance.football/nft/metadata/${uuidv4()}`;
    }

    // In production, upload to IPFS and return the URI
    // const ipfsHash = await this.uploadToIPFS(metadata);
    // return `ipfs://${ipfsHash}`;
    
    // For now, return a mock URI
    return `https://api.renaissance.football/nft/metadata/${uuidv4()}`;
  }

  /**
   * Create audit trail entry
   */
  private async createAuditTrail(queryRunner: any, data: any): Promise<void> {
    // You can create a separate AuditLog entity or use a logging service
    this.logger.log(`AUDIT: ${JSON.stringify(data)}`);
    
    // If you have an AuditLog repository, save there
    // const auditRepo = queryRunner?.manager.getRepository(AuditLog) || this.auditRepository;
    // await auditRepo.save(auditRepo.create(data));
  }

  /**
   * Helper methods for NFT metadata generation
   */
  private generateNFTName(rewardType: RewardType, playerId?: string): string {
    const baseNames = {
      [RewardType.MATCH_ATTENDANCE]: 'Match Attendance Trophy',
      [RewardType.BETTING_WIN]: 'Betting Champion',
      [RewardType.PREDICTION_CORRECT]: 'Prediction Master',
      [RewardType.REFERRAL]: 'Community Builder',
      [RewardType.CONTENT_CREATION]: 'Content Creator',
      [RewardType.COMMUNITY_ENGAGEMENT]: 'Fan Ambassador',
      [RewardType.SPECIAL_ACHIEVEMENT]: 'Legendary Fan',
    };
    
    const baseName = baseNames[rewardType] || 'Renaissance Fan Card';
    
    if (playerId) {
      return `${baseName} - Player #${playerId}`;
    }
    
    return baseName;
  }

  private generateNFTDescription(rewardType: RewardType, data: any): string {
    const descriptions = {
      [RewardType.MATCH_ATTENDANCE]: 'Awarded for attending a live match and showing your support!',
      [RewardType.BETTING_WIN]: 'Earned by successfully winning a bet on the Renaissance platform.',
      [RewardType.PREDICTION_CORRECT]: 'Awarded for accurately predicting match outcomes.',
      [RewardType.REFERRAL]: 'Earned by bringing new fans to the Renaissance community.',
      [RewardType.CONTENT_CREATION]: 'Awarded for creating engaging football content.',
      [RewardType.COMMUNITY_ENGAGEMENT]: 'Earned through active participation in the community.',
      [RewardType.SPECIAL_ACHIEVEMENT]: 'A special achievement in the Renaissance ecosystem.',
    };
    
    return descriptions[rewardType] || 'A Renaissance football fan NFT';
  }

  private getNFTImageUrl(rewardType: RewardType, playerId?: string): string {
    // Return appropriate image URL based on reward type
    const baseUrl = this.configService.get('NFT_IMAGE_BASE_URL');
    return `${baseUrl}/${rewardType}${playerId ? `/${playerId}` : ''}.png`;
  }

  private getDefaultValueForRewardType(rewardType: RewardType): number {
    const values = {
      [RewardType.MATCH_ATTENDANCE]: 10,
      [RewardType.BETTING_WIN]: 50,
      [RewardType.PREDICTION_CORRECT]: 25,
      [RewardType.REFERRAL]: 30,
      [RewardType.CONTENT_CREATION]: 40,
      [RewardType.COMMUNITY_ENGAGEMENT]: 20,
      [RewardType.SPECIAL_ACHIEVEMENT]: 100,
    };
    
    return values[rewardType] || 5;
  }

  private calculateRarity(value: number): string {
    if (value >= 90) return 'Legendary';
    if (value >= 70) return 'Epic';
    if (value >= 50) return 'Rare';
    if (value >= 30) return 'Uncommon';
    return 'Common';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}