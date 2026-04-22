import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { CriticalAction } from '../common/decorators/critical-action.decorator';
import { JackpotService } from './jackpot.service';
import { Request } from 'express';

@Controller('spin-game/jackpot')
export class JackpotController {
  constructor(private readonly jackpotService: JackpotService) {}

  /**
   * Get current jackpot amounts
   * Public endpoint - no auth required
   */
  @Get('pools')
  async getJackpotPools() {
    const pools = await this.jackpotService.getCurrentJackpots();
    return {
      success: true,
      data: {
        mini: pools.mini,
        major: pools.major,
        mega: pools.mega,
        grand: pools.grand,
        currency: 'XLM',
      },
    };
  }

  /**
   * Get user's unclaimed jackpot winnings
   * Protected endpoint - requires authentication
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-winnings')
  async getMyJackpotWinnings(@Req() req: Request) {
    const userId = (req as any).user?.id;
    const winnings = await this.jackpotService.getUserJackpotWinnings(userId);

    return {
      success: true,
      data: {
        winnings: winnings.map((w) => ({
          id: w.id,
          tier: w.jackpotTier,
          amount: Number(w.wonAmount),
          claimed: w.claimed,
          expiryDate: w.expiryDate,
          createdAt: w.createdAt,
        })),
      },
    };
  }

  /**
   * Claim jackpot winnings
   * Protected endpoint - requires authentication
   */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @CriticalAction('claim_jackpot')
  @HttpCode(HttpStatus.OK)
  @Post('claim/:winnerId')
  async claimJackpotWinnings(
    @Param('winnerId') winnerId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const result = await this.jackpotService.claimJackpotWinnings(winnerId, userId);

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    return {
      success: true,
      message: result.message,
      data: {
        amount: result.amount,
        claimedAt: new Date(),
      },
    };
  }

  /**
   * Get jackpot configuration (public info)
   * Public endpoint - no auth required
   */
  @Get('config')
  async getJackpotConfig() {
    const config = this.jackpotService.getJackpotConfig();
    const enabled = this.jackpotService.isJackpotEnabled();

    return {
      success: true,
      data: {
        enabled,
        tiers: {
          mini: {
            name: 'Mini Jackpot',
            contributionPercentage: config.tiers.MINI.contributionPercentage,
            triggerProbability: config.tiers.MINI.triggerProbability,
            minSpinsToTrigger: config.tiers.MINI.minSpinsToTrigger,
          },
          major: {
            name: 'Major Jackpot',
            contributionPercentage: config.tiers.MAJOR.contributionPercentage,
            triggerProbability: config.tiers.MAJOR.triggerProbability,
            minSpinsToTrigger: config.tiers.MAJOR.minSpinsToTrigger,
          },
          mega: {
            name: 'Mega Jackpot',
            contributionPercentage: config.tiers.MEGA.contributionPercentage,
            triggerProbability: config.tiers.MEGA.triggerProbability,
            minSpinsToTrigger: config.tiers.MEGA.minSpinsToTrigger,
          },
          grand: {
            name: 'Grand Jackpot',
            contributionPercentage: config.tiers.GRAND.contributionPercentage,
            triggerProbability: config.tiers.GRAND.triggerProbability,
            minSpinsToTrigger: config.tiers.GRAND.minSpinsToTrigger,
          },
        },
      },
    };
  }

  /**
   * Check if jackpot system is enabled
   * Public endpoint - no auth required
   */
  @Get('status')
  async getJackpotStatus() {
    return {
      success: true,
      data: {
        enabled: this.jackpotService.isJackpotEnabled(),
      },
    };
  }
}