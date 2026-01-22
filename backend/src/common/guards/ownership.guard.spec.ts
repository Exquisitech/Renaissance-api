import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { Repository } from 'typeorm';
import { UserRole } from '../../users/entities/user.entity';
import { Bet } from '../../bets/entities/bet.entity';
import { Post as PostEntity } from '../../posts/entities/post.entity';
import { OwnershipGuard } from './ownership.guard';

describe('OwnershipGuard', () => {
  let reflector: Reflector;
  let moduleRef: ModuleRef;
  let mockRepository: jest.Mocked<Repository<any>>;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    role: UserRole.USER,
  };

  const mockAdmin = {
    userId: 'admin-123',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const mockBet = {
    id: 'bet-123',
    userId: 'user-123',
    stakeAmount: 100,
    user: { id: 'user-123' },
  };

  const mockPost = {
    id: 'post-123',
    title: 'Test Post',
    author: { id: 'user-123' },
  };

  const createMockContext = (
    user: any,
    params: any = { id: 'bet-123' },
  ): ExecutionContext => {
    const mockRequest = {
      user,
      params,
      resource: null,
    } as any;

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
    } as any;

    const mockModuleRef = {
      get: jest.fn().mockReturnValue(mockRepository),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [Reflector, { provide: ModuleRef, useValue: mockModuleRef }],
    }).compile();

    reflector = module.get<Reflector>(Reflector);
    moduleRef = module.get<ModuleRef>(ModuleRef);
  });

  describe('Bet ownership with userId field', () => {
    it('should allow access when user owns the bet', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      mockRepository.findOne.mockResolvedValue(mockBet);
      const context = createMockContext(mockUser);

      const result = await guardInstance.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access when admin accesses any bet', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      mockRepository.findOne.mockResolvedValue(mockBet);
      const context = createMockContext(mockAdmin);

      const result = await guardInstance.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not own the bet', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      const otherUser = { ...mockUser, userId: 'other-user' };
      mockRepository.findOne.mockResolvedValue(mockBet);
      const context = createMockContext(otherUser);

      await expect(guardInstance.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when bet does not exist', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      mockRepository.findOne.mockResolvedValue(null);
      const context = createMockContext(mockUser);

      await expect(guardInstance.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Post ownership with author relationship', () => {
    it('should allow access when user owns the post', async () => {
      const guard = OwnershipGuard({
        entity: PostEntity,
        ownerField: 'author',
      });
      const guardInstance = new guard(reflector, moduleRef);

      mockRepository.findOne.mockResolvedValue(mockPost);
      const context = createMockContext(mockUser, { id: 'post-123' });

      const result = await guardInstance.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not own the post', async () => {
      const guard = OwnershipGuard({
        entity: PostEntity,
        ownerField: 'author',
      });
      const guardInstance = new guard(reflector, moduleRef);

      const otherUser = { ...mockUser, userId: 'other-user' };
      mockRepository.findOne.mockResolvedValue(mockPost);
      const context = createMockContext(otherUser, { id: 'post-123' });

      await expect(guardInstance.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Security edge cases', () => {
    it('should throw ForbiddenException when no user is authenticated', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      const context = createMockContext(null);

      await expect(guardInstance.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when resource ID is missing', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      const context = createMockContext(mockUser, {});

      await expect(guardInstance.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when repository is not found', async () => {
      const guard = OwnershipGuard({ entity: Bet, ownerField: 'userId' });
      const guardInstance = new guard(reflector, moduleRef);

      (moduleRef.get as jest.Mock).mockReturnValue(null);
      const context = createMockContext(mockUser);

      await expect(guardInstance.canActivate(context)).rejects.toThrow(
        'Repository for Bet not found',
      );
    });
  });
});
