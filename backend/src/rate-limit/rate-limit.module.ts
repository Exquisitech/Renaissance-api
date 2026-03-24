import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { UserLastInteraction, RateLimitConfig } from './entities';
import { RateLimitInteractionService } from './rate-limit-interaction.service';
import { RateLimitInteractionGuard } from './guards/rate-limit-interaction.guard';
import { RateLimitViolationListener } from './listeners/rate-limit-violation.listener';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([UserLastInteraction, RateLimitConfig]),
  ],
  providers: [
    RateLimitInteractionService,
    RateLimitInteractionGuard,
    RateLimitViolationListener,
  ],
  exports: [RateLimitInteractionService, RateLimitInteractionGuard],
})
export class RateLimitModule {}
