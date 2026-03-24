import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AdminOverrideLog,
  AdminOverrideAction,
  OverrideStatus,
} from './entities/admin-override-log.entity';
import { User } from '../users/entities/user.entity';
import { Bet, BetStatus } from '../bets/entities/bet.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { FreeBetVoucher } from '../free-bet-vouchers/entities/free-bet-voucher.entity';
import { Spin, SpinStatus } from '../spin/entities/spin.entity';
import {
  BalanceAdjustmentDto,
  BetOutcomeCorrectionDto,
  FreeBetVoucherIssuanceDto,
  SpinRewardReversalDto,
  OverrideApprovalDto,
  OverrideReversalDto,
  OverrideQueryDto,
} from './dto/admin-override.dto';

@Injectable()
export class AdminOverrideService {
  constructor(
    @InjectRepository(AdminOverrideLog)
    private overrideLogRepository: Repository<AdminOverrideLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(FreeBetVoucher)
    private voucherRepository: Repository<FreeBetVoucher>,
    @InjectRepository(Spin)
    private spinRepository: Repository<Spin>,
    private dataSource: DataSource,
  ) {}

  /**
   * Adjust user balance with full audit trail
   */
  async adjustUserBalance(
    userId: string,
    adminId: string,
    dto: BalanceAdjustmentDto,
  ): Promise<AdminOverrideLog> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate user exists
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate admin has elevated permissions (would check role in real implementation)
      await this.validateAdminPermissions(adminId);

      // Calculate new balance
      const currentBalance = Number(user.walletBalance);
      const adjustmentAmount =
        dto.operation === 'add' ? dto.amount : -dto.amount;
      const newBalance = currentBalance + adjustmentAmount;

      if (newBalance < 0) {
        throw new BadRequestException(
          'Balance adjustment would result in negative balance',
        );
      }

      // Create override log entry
      const overrideLog = this.overrideLogRepository.create({
        adminId,
        actionType: AdminOverrideAction.BALANCE_ADJUSTMENT,
        status: OverrideStatus.EXECUTED,
        affectedUserId: userId,
        affectedEntityId: userId,
        affectedEntityType: 'user',
        reason: dto.reason,
        previousValues: {
          walletBalance: currentBalance,
        },
        newValues: {
          walletBalance: newBalance,
        },
        metadata: {
          adjustmentAmount,
          operation: dto.operation,
          description: dto.description,
        },
        executedAt: new Date(),
        executedBy: adminId,
        requiresOnChainApproval: dto.requiresOnChainApproval || false,
      });

      await queryRunner.manager.save(AdminOverrideLog, overrideLog);

      // Update user balance
      user.walletBalance = newBalance as any;
      await queryRunner.manager.save(User, user);

      // Create transaction record
      const transaction = this.transactionRepository.create({
        userId,
        type:
          adjustmentAmount > 0
            ? TransactionType.WALLET_DEPOSIT
            : TransactionType.WALLET_WITHDRAWAL,
        amount: Math.abs(adjustmentAmount),
        status: TransactionStatus.COMPLETED,
        referenceId: overrideLog.id,
        relatedEntityId: overrideLog.id,
        metadata: {
          adminOverrideId: overrideLog.id,
          reason: dto.reason,
          adjustmentAmount,
          previousBalance: currentBalance,
          newBalance,
        },
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();
      return overrideLog;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Correct bet outcome with audit trail
   */
  async correctBetOutcome(
    adminId: string,
    dto: BetOutcomeCorrectionDto,
  ): Promise<AdminOverrideLog> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate bet exists
      const bet = await queryRunner.manager.findOne(Bet, {
        where: { id: dto.betId },
        relations: ['user'],
      });
      if (!bet) {
        throw new NotFoundException(`Bet with ID ${dto.betId} not found`);
      }

      // Validate admin permissions
      await this.validateAdminPermissions(adminId);

      // Check if bet is already settled (requires special approval)
      const isSettled =
        bet.status === BetStatus.WON || bet.status === BetStatus.LOST;
      const requiresOnChainApproval =
        isSettled || dto.requiresOnChainApproval || false;

      // Store previous values
      const previousValues = {
        status: bet.status,
        settledAt: bet.settledAt,
      };

      // Update bet outcome
      let newStatus = bet.status;
      let newSettledAt: Date | undefined = bet.settledAt;

      switch (dto.newOutcome) {
        case 'won':
          newStatus = BetStatus.WON;
          newSettledAt = newSettledAt || new Date();
          break;
        case 'lost':
          newStatus = BetStatus.LOST;
          newSettledAt = newSettledAt || new Date();
          break;
        case 'void':
          newStatus = BetStatus.CANCELLED;
          newSettledAt = new Date();
          break;
        case 'pending':
          newStatus = BetStatus.PENDING;
          newSettledAt = undefined;
          break;
      }

      // Create override log
      const overrideLog = this.overrideLogRepository.create({
        adminId,
        actionType: AdminOverrideAction.BET_OUTCOME_CORRECTION,
        status: requiresOnChainApproval
          ? OverrideStatus.PENDING
          : OverrideStatus.EXECUTED,
        affectedUserId: bet.userId,
        affectedEntityId: dto.betId,
        affectedEntityType: 'bet',
        reason: dto.reason,
        previousValues,
        newValues: {
          status: newStatus,
          settledAt: newSettledAt,
        },
        metadata: {
          originalStatus: bet.status,
          newOutcome: dto.newOutcome,
          outcomeReason: dto.outcomeReason,
          requiresOnChainApproval,
        },
        executedAt: requiresOnChainApproval ? undefined : new Date(),
        executedBy: requiresOnChainApproval ? undefined : adminId,
        requiresOnChainApproval,
      } as any);

      const savedOverrideLog = (await queryRunner.manager.save(
        AdminOverrideLog,
        overrideLog,
      )) as unknown as AdminOverrideLog;

      // If not requiring on-chain approval, execute immediately
      if (!requiresOnChainApproval) {
        // Update bet
        bet.status = newStatus;
        bet.settledAt = newSettledAt as any;
        await queryRunner.manager.save(Bet, bet);

        // Handle balance adjustments for user if bet was won
        if (newStatus === BetStatus.WON && dto.payoutAmount) {
          const user = await queryRunner.manager.findOne(User, {
            where: { id: bet.userId },
          });
          if (user) {
            const currentBalance = Number(user.walletBalance);
            const newBalance = currentBalance + Number(dto.payoutAmount);
            user.walletBalance = newBalance as any;
            await queryRunner.manager.save(User, user);

            // Create payout transaction
            const transaction = this.transactionRepository.create({
              userId: bet.userId,
              type: TransactionType.BET_WINNING,
              amount: Number(dto.payoutAmount),
              status: TransactionStatus.COMPLETED,
              referenceId: bet.id,
              relatedEntityId: savedOverrideLog.id,
              metadata: {
                adminOverrideId: savedOverrideLog.id,
                reason: dto.reason,
              },
            });
            await queryRunner.manager.save(Transaction, transaction);
          }
        }
      }

      await queryRunner.commitTransaction();
      return savedOverrideLog;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Issue manual free bet voucher
   */
  async issueFreeBetVoucher(
    userId: string,
    adminId: string,
    dto: FreeBetVoucherIssuanceDto,
  ): Promise<AdminOverrideLog> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate user exists
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate admin permissions
      await this.validateAdminPermissions(adminId);

      // Validate expiration date
      if (dto.expiresAt <= new Date()) {
        throw new BadRequestException('Expiration date must be in the future');
      }

      // Create voucher
      const voucher = this.voucherRepository.create({
        userId,
        amount: dto.amount,
        expiresAt: dto.expiresAt,
        used: false,
        metadata: {
          issuedByAdmin: adminId,
          reason: dto.reason,
          description: dto.description,
          metadata: dto.metadata ? JSON.parse(dto.metadata) : {},
        },
      });

      await queryRunner.manager.save(FreeBetVoucher, voucher);

      // Create override log
      const overrideLog = this.overrideLogRepository.create({
        adminId,
        actionType: AdminOverrideAction.FREE_BET_VOUCHER_ISSUED,
        status: OverrideStatus.EXECUTED,
        affectedUserId: userId,
        affectedEntityId: voucher.id,
        affectedEntityType: 'free_bet_voucher',
        reason: dto.reason,
        previousValues: {} as any,
        newValues: {
          amount: dto.amount,
          expiresAt: dto.expiresAt,
        },
        metadata: {
          description: dto.description,
          customMetadata: dto.metadata,
        },
        executedAt: new Date(),
        executedBy: adminId,
        requiresOnChainApproval: false,
      } as any);

      const savedOverrideLog = (await queryRunner.manager.save(
        AdminOverrideLog,
        overrideLog,
      )) as unknown as AdminOverrideLog;

      await queryRunner.commitTransaction();
      return savedOverrideLog;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reverse spin reward (pre-settlement only)
   */
  async reverseSpinReward(
    adminId: string,
    dto: SpinRewardReversalDto,
  ): Promise<AdminOverrideLog> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate spin exists
      const spin = await queryRunner.manager.findOne(Spin, {
        where: { id: dto.spinId },
        relations: ['user'],
      });
      if (!spin) {
        throw new NotFoundException(`Spin with ID ${dto.spinId} not found`);
      }

      // Validate admin permissions
      await this.validateAdminPermissions(adminId);

      // Check if spin is already settled on-chain
      const isSettled = spin.status === SpinStatus.COMPLETED;
      if (isSettled) {
        throw new BadRequestException(
          'Cannot reverse spin reward after on-chain settlement',
        );
      }

      // Store previous values
      const previousValues = {
        status: spin.status,
        payoutAmount: spin.payoutAmount,
        metadata: spin.metadata,
      };

      // Create override log
      const overrideLog = this.overrideLogRepository.create({
        adminId,
        actionType: AdminOverrideAction.SPIN_REWARD_REVERSAL,
        status: OverrideStatus.EXECUTED,
        affectedUserId: spin.userId,
        affectedEntityId: dto.spinId,
        affectedEntityType: 'spin',
        reason: dto.reason,
        previousValues,
        newValues: {
          status: SpinStatus.FAILED,
          payoutAmount: 0,
          metadata: {
            ...spin.metadata,
            reversed: true,
            reversalReason: dto.reversalReason,
            reversedAt: new Date(),
            reversedBy: adminId,
          },
        },
        metadata: {
          originalPayout: spin.payoutAmount,
          reversalReason: dto.reversalReason,
        },
        executedAt: new Date(),
        executedBy: adminId,
        requiresOnChainApproval: false,
      });

      await queryRunner.manager.save(AdminOverrideLog, overrideLog);

      // Update spin
      spin.status = SpinStatus.FAILED;
      spin.payoutAmount = 0;
      spin.metadata = {
        ...spin.metadata,
        reversed: true,
        reversalReason: dto.reversalReason,
        reversedAt: new Date(),
        reversedBy: adminId,
      };
      await queryRunner.manager.save(Spin, spin);

      // If spin had payout, reverse it from user balance
      if (spin.payoutAmount > 0) {
        const user = await queryRunner.manager.findOne(User, {
          where: { id: spin.userId },
        });
        if (user) {
          const currentBalance = Number(user.walletBalance);
          const newBalance = currentBalance - Number(spin.payoutAmount);

          if (newBalance < 0) {
            throw new BadRequestException(
              'Cannot reverse spin reward: insufficient user balance',
            );
          }

          user.walletBalance = newBalance as any;
          await queryRunner.manager.save(User, user);

          // Create reversal transaction
          const transaction = this.transactionRepository.create({
            userId: spin.userId,
            type: TransactionType.WALLET_WITHDRAWAL,
            amount: Number(spin.payoutAmount),
            status: TransactionStatus.COMPLETED,
            referenceId: spin.id,
            relatedEntityId: overrideLog.id,
            metadata: {
              adminOverrideId: overrideLog.id,
              reason: dto.reason,
              reversalReason: dto.reversalReason,
            },
          });
          await queryRunner.manager.save(Transaction, transaction);
        }
      }

      await queryRunner.commitTransaction();
      return overrideLog;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get override logs with filtering
   */
  async getOverrideLogs(
    query: OverrideQueryDto,
  ): Promise<{ data: AdminOverrideLog[]; total: number }> {
    const qb = this.overrideLogRepository
      .createQueryBuilder('override')
      .leftJoinAndSelect('override.admin', 'admin')
      .leftJoinAndSelect('override.affectedUser', 'affectedUser')
      .leftJoinAndSelect(
        'override.onChainApprovalAdmin',
        'onChainApprovalAdmin',
      )
      .leftJoinAndSelect('override.reversedByAdmin', 'reversedByAdmin');

    // Apply filters
    if (query.actionType) {
      qb.andWhere('override.actionType = :actionType', {
        actionType: query.actionType,
      });
    }

    if (query.status) {
      qb.andWhere('override.status = :status', { status: query.status });
    }

    if (query.adminId) {
      qb.andWhere('override.adminId = :adminId', { adminId: query.adminId });
    }

    if (query.affectedUserId) {
      qb.andWhere('override.affectedUserId = :affectedUserId', {
        affectedUserId: query.affectedUserId,
      });
    }

    if (query.startDate) {
      qb.andWhere('override.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      qb.andWhere('override.createdAt <= :endDate', { endDate: query.endDate });
    }

    const total = await qb.getCount();

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const data = await qb
      .orderBy('override.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  /**
   * Validate admin permissions
   */
  private async validateAdminPermissions(
    adminId: string,
    requiresElevated: boolean = false,
  ): Promise<void> {
    // In a real implementation, this would check:
    // 1. User exists and is admin
    // 2. User has required role/permissions
    // 3. User is not suspended/banned
    // 4. Rate limiting checks

    // For now, we'll just verify the admin exists
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ForbiddenException('Admin user not found');
    }

    // In real implementation, check role:
    // if (requiresElevated && !admin.hasRole('SUPER_ADMIN')) {
    //   throw new ForbiddenException('Insufficient permissions for this action');
    // }
  }
}
