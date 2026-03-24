import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SpinSession,
  SpinSessionStatus,
  RewardType,
} from './entities/spin-session.entity';
import { CreateSpinSessionDto } from './dto/create-spin-session.dto';

/**
 * Service for managing SpinSession entities.
 *
 * Provides CRUD operations for spin session tracking with:
 * - Immutability enforcement after completion
 * - User-scoped queries
 * - Audit-friendly logging
 */
@Injectable()
export class SpinSessionService {
  private readonly logger = new Logger(SpinSessionService.name);

  constructor(
    @InjectRepository(SpinSession)
    private readonly spinSessionRepository: Repository<SpinSession>,
  ) {}

  /**
   * Create a new spin session in pending status.
   *
   * @param userId - The user's ID
   * @param createDto - The spin session creation data
   * @returns The created SpinSession entity
   */
  async create(
    userId: string,
    createDto: CreateSpinSessionDto,
  ): Promise<SpinSession> {
    const spinSession = this.spinSessionRepository.create({
      userId,
      stakeAmount: createDto.stakeAmount,
      rewardType: createDto.rewardType || RewardType.NONE,
      rewardValue: createDto.rewardValue || 0,
      status: SpinSessionStatus.PENDING,
      txReference: createDto.txReference || null,
    });

    const saved = await this.spinSessionRepository.save(spinSession);
    this.logger.log(`SpinSession created: ${saved.id} for user ${userId}`);
    return saved;
  }

  /**
   * Find a spin session by ID.
   *
   * @param id - The spin session ID
   * @returns The SpinSession entity or null if not found
   */
  async findById(id: string): Promise<SpinSession | null> {
    return this.spinSessionRepository.findOne({ where: { id } });
  }

  /**
   * Find a spin session by ID, throwing if not found.
   *
   * @param id - The spin session ID
   * @returns The SpinSession entity
   * @throws NotFoundException if not found
   */
  async findByIdOrFail(id: string): Promise<SpinSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundException(`SpinSession with ID ${id} not found`);
    }
    return session;
  }

  /**
   * Get spin sessions for a specific user, ordered by createdAt descending.
   *
   * @param userId - The user's ID
   * @param limit - Maximum number of records to return (default: 50)
   * @returns Array of SpinSession entities
   */
  async findByUserId(
    userId: string,
    limit: number = 50,
  ): Promise<SpinSession[]> {
    return this.spinSessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Complete a spin session with reward details.
   * Once completed, the session becomes immutable.
   *
   * @param id - The spin session ID
   * @param rewardType - The type of reward earned
   * @param rewardValue - The value of the reward
   * @param txReference - Optional transaction reference
   * @returns The updated SpinSession entity
   * @throws NotFoundException if session not found
   * @throws BadRequestException if session is already finalized
   */
  async complete(
    id: string,
    rewardType: RewardType,
    rewardValue: number,
    txReference?: string,
  ): Promise<SpinSession> {
    const session = await this.findByIdOrFail(id);

    this.assertMutable(session);

    session.rewardType = rewardType;
    session.rewardValue = rewardValue;
    session.status = SpinSessionStatus.COMPLETED;
    if (txReference) {
      session.txReference = txReference;
    }

    const saved = await this.spinSessionRepository.save(session);
    this.logger.log(
      `SpinSession completed: ${id}, reward: ${rewardType} = ${rewardValue}`,
    );
    return saved;
  }

  /**
   * Mark a spin session as failed.
   * Once failed, the session becomes immutable.
   *
   * @param id - The spin session ID
   * @param txReference - Optional transaction reference
   * @returns The updated SpinSession entity
   * @throws NotFoundException if session not found
   * @throws BadRequestException if session is already finalized
   */
  async fail(id: string, txReference?: string): Promise<SpinSession> {
    const session = await this.findByIdOrFail(id);

    this.assertMutable(session);

    session.status = SpinSessionStatus.FAILED;
    if (txReference) {
      session.txReference = txReference;
    }

    const saved = await this.spinSessionRepository.save(session);
    this.logger.log(`SpinSession failed: ${id}`);
    return saved;
  }

  /**
   * Update the transaction reference for a pending session.
   *
   * @param id - The spin session ID
   * @param txReference - The transaction reference to set
   * @returns The updated SpinSession entity
   * @throws NotFoundException if session not found
   * @throws BadRequestException if session is already finalized
   */
  async setTxReference(id: string, txReference: string): Promise<SpinSession> {
    const session = await this.findByIdOrFail(id);

    this.assertMutable(session);

    session.txReference = txReference;
    return this.spinSessionRepository.save(session);
  }

  /**
   * Get aggregate statistics for spin sessions.
   *
   * @returns Statistics object with totals and counts by status
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    totalStaked: number;
    totalRewards: number;
    statusCounts: Record<SpinSessionStatus, number>;
    rewardTypeCounts: Record<RewardType, number>;
  }> {
    const sessions = await this.spinSessionRepository.find();

    const stats = {
      totalSessions: sessions.length,
      totalStaked: 0,
      totalRewards: 0,
      statusCounts: {
        [SpinSessionStatus.PENDING]: 0,
        [SpinSessionStatus.COMPLETED]: 0,
        [SpinSessionStatus.FAILED]: 0,
      },
      rewardTypeCounts: {
        [RewardType.XP]: 0,
        [RewardType.TOKENS]: 0,
        [RewardType.NFT]: 0,
        [RewardType.BONUS_SPIN]: 0,
        [RewardType.MULTIPLIER]: 0,
        [RewardType.NONE]: 0,
      },
    };

    for (const session of sessions) {
      stats.totalStaked += Number(session.stakeAmount);
      stats.totalRewards += Number(session.rewardValue);
      stats.statusCounts[session.status]++;
      stats.rewardTypeCounts[session.rewardType]++;
    }

    return stats;
  }

  /**
   * Assert that a session can be modified (is still pending).
   *
   * @param session - The session to check
   * @throws BadRequestException if session is completed or failed
   */
  private assertMutable(session: SpinSession): void {
    if (
      session.status === SpinSessionStatus.COMPLETED ||
      session.status === SpinSessionStatus.FAILED
    ) {
      throw new BadRequestException(
        `SpinSession ${session.id} is immutable after ${session.status} status`,
      );
    }
  }
}
