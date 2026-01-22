import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
  params: Record<string, string>;
}

interface RequestUser {
  userId: string;
  email: string;
  role: UserRole;
}

interface OwnershipGuardOptions {
  entity: any;
  ownerField?: string;
  resourceIdParam?: string;
  adminBypass?: boolean;
}

export function OwnershipGuard(options: OwnershipGuardOptions) {
  @Injectable()
  class OwnershipGuardClass implements CanActivate {
    constructor(
      public reflector: Reflector,
      public moduleRef: ModuleRef,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const {
        entity,
        ownerField = 'userId',
        resourceIdParam = 'id',
        adminBypass = true,
      } = options;

      const request = context
        .switchToHttp()
        .getRequest<AuthenticatedRequest & { resource?: any }>();
      const user = request.user;

      if (!user || !user.userId) {
        throw new ForbiddenException('Access denied: Authentication required');
      }

      // Admin bypass check
      if (adminBypass && user.role === UserRole.ADMIN) {
        return true;
      }

      const resourceId = request.params[resourceIdParam];
      if (!resourceId) {
        throw new NotFoundException(
          'Resource ID not found in request parameters',
        );
      }

      // Get repository dynamically
      const repository = this.moduleRef.get<Repository<any>>(
        `${entity.name}Repository`,
        { strict: false },
      );

      if (!repository) {
        throw new Error(`Repository for ${entity.name} not found`);
      }

      // Find the resource
      const resource = await repository.findOne({
        where: { id: resourceId },
      });

      if (!resource) {
        throw new NotFoundException('Resource not found');
      }

      // Check ownership
      let resourceOwnerId: string;

      if (ownerField === 'author') {
        // Handle relationship-based ownership (like Post.author)
        resourceOwnerId = resource.author?.id;
      } else if (ownerField === 'user') {
        // Handle relationship-based ownership (like Bet.user)
        resourceOwnerId = resource.user?.id;
      } else {
        // Handle direct field ownership (like userId)
        resourceOwnerId = resource[ownerField];
      }

      if (!resourceOwnerId) {
        throw new ForbiddenException(
          'Access denied: Resource ownership not determined',
        );
      }

      if (resourceOwnerId !== user.userId) {
        throw new ForbiddenException(
          'Access denied: You do not own this resource',
        );
      }

      // Attach the resource to the request for potential use in controllers
      request.resource = resource;

      return true;
    }
  }

  return OwnershipGuardClass;
}
