import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindOptionsOrder } from 'typeorm';
import { PlayerCardMetadata } from './entities/player-card-metadata.entity';
import {
  CreatePlayerCardMetadataDto,
  UpdatePlayerCardMetadataDto,
} from './dto/create-player-card-metadata.dto';
import { CacheInvalidationService } from '../common/cache/cache-invalidation.service';

export interface PaginatedPlayerCardMetadata {
  data: PlayerCardMetadata[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class PlayerCardMetadataService {
  constructor(
    @InjectRepository(PlayerCardMetadata)
    private readonly playerCardMetadataRepository: Repository<PlayerCardMetadata>,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  /**
   * Create a new player card metadata
   */
  async create(
    createPlayerCardMetadataDto: CreatePlayerCardMetadataDto,
  ): Promise<PlayerCardMetadata> {
    const playerCardMetadata = this.playerCardMetadataRepository.create(
      createPlayerCardMetadataDto,
    );
    const savedMetadata =
      await this.playerCardMetadataRepository.save(playerCardMetadata);
    await this.cacheInvalidationService.invalidatePattern('player-cards*');
    return savedMetadata;
  }

  /**
   * Get all player card metadata with pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    isPublishedOnly: boolean = true,
  ): Promise<PaginatedPlayerCardMetadata> {
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<PlayerCardMetadata> = {};

    if (isPublishedOnly) {
      where.isPublished = true;
    }

    const [data, total] = await this.playerCardMetadataRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' } as FindOptionsOrder<PlayerCardMetadata>,
      relations: ['player'],
    });

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Get a single player card metadata by ID
   */
  async findOne(
    id: string,
    isPublishedOnly: boolean = true,
  ): Promise<PlayerCardMetadata> {
    const where: FindOptionsWhere<PlayerCardMetadata> = { id };

    if (isPublishedOnly) {
      where.isPublished = true;
    }

    const playerCardMetadata = await this.playerCardMetadataRepository.findOne({
      where,
      relations: ['player'],
    });

    if (!playerCardMetadata) {
      throw new NotFoundException(
        `Player card metadata with ID ${id} not found`,
      );
    }

    return playerCardMetadata;
  }

  /**
   * Get player card metadata by contract address and token ID
   */
  async findByTokenId(
    contractAddress: string,
    tokenId: string,
    isPublishedOnly: boolean = true,
  ): Promise<PlayerCardMetadata> {
    const where: FindOptionsWhere<PlayerCardMetadata> = {
      contractAddress,
      tokenId,
    };

    if (isPublishedOnly) {
      where.isPublished = true;
    }

    const playerCardMetadata = await this.playerCardMetadataRepository.findOne({
      where,
      relations: ['player'],
    });

    if (!playerCardMetadata) {
      throw new NotFoundException(
        `Player card metadata with token ${tokenId} not found`,
      );
    }

    return playerCardMetadata;
  }

  /**
   * Get all player card metadata for a specific player
   */
  async findByPlayerId(
    playerId: string,
    page: number = 1,
    limit: number = 10,
    isPublishedOnly: boolean = true,
  ): Promise<PaginatedPlayerCardMetadata> {
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<PlayerCardMetadata> = { playerId };

    if (isPublishedOnly) {
      where.isPublished = true;
    }

    const [data, total] = await this.playerCardMetadataRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' } as FindOptionsOrder<PlayerCardMetadata>,
      relations: ['player'],
    });

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Update player card metadata
   */
  async update(
    id: string,
    updatePlayerCardMetadataDto: UpdatePlayerCardMetadataDto,
  ): Promise<PlayerCardMetadata> {
    const playerCardMetadata = await this.playerCardMetadataRepository.findOne({
      where: { id },
    });

    if (!playerCardMetadata) {
      throw new NotFoundException(
        `Player card metadata with ID ${id} not found`,
      );
    }

    Object.assign(playerCardMetadata, updatePlayerCardMetadataDto);
    const savedMetadata =
      await this.playerCardMetadataRepository.save(playerCardMetadata);
    await this.cacheInvalidationService.invalidatePattern('player-cards*');
    return savedMetadata;
  }

  /**
   * Delete player card metadata
   */
  async remove(id: string): Promise<void> {
    const playerCardMetadata = await this.playerCardMetadataRepository.findOne({
      where: { id },
    });

    if (!playerCardMetadata) {
      throw new NotFoundException(
        `Player card metadata with ID ${id} not found`,
      );
    }

    await this.playerCardMetadataRepository.remove(playerCardMetadata);
    await this.cacheInvalidationService.invalidatePattern('player-cards*');
  }

  /**
   * Get player card metadata by rarity
   */
  async findByRarity(
    rarity: string,
    page: number = 1,
    limit: number = 10,
    isPublishedOnly: boolean = true,
  ): Promise<PaginatedPlayerCardMetadata> {
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<PlayerCardMetadata> = {
      rarity: rarity as any,
    };

    if (isPublishedOnly) {
      where.isPublished = true;
    }

    const [data, total] = await this.playerCardMetadataRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' } as FindOptionsOrder<PlayerCardMetadata>,
      relations: ['player'],
    });

    return {
      data,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }
}
