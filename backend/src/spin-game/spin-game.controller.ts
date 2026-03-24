import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SpinGameService } from './spin-game.service';
import {
  SpinRequestDto,
  SpinResultDto,
  UserSpinStatsDto,
  SpinEligibilityDto,
} from './dto/spin-game.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CriticalAction } from '../common/decorators/critical-action.decorator';
import { RateLimitInteractionGuard } from '../rate-limit/guards/rate-limit-interaction.guard';
import { RateLimitAction } from '../rate-limit/decorators/rate-limit-action.decorator';

@ApiTags('Spin Game')
@Controller('spin-game')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpinGameController {
  constructor(private readonly spinGameService: SpinGameService) {}

  @Get('eligibility')
  @ApiOperation({ summary: 'Check if user is eligible to spin' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SpinEligibilityDto,
    description: 'Returns eligibility status and remaining limits',
  })
  async checkEligibility(@Req() req: any): Promise<SpinEligibilityDto> {
    return this.spinGameService.checkEligibility(
      req.user.userId ?? req.user.id,
    );
  }

  @Post('spin')
  @CriticalAction('spin_game.spin')
  @UseGuards(RateLimitInteractionGuard)
  @RateLimitAction('spin_game')
  @ApiOperation({ summary: 'Execute a spin' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: SpinResultDto,
    description: 'Returns the result of the spin including reward',
  })
  async spin(
    @Req() req: any,
    @Body() dto: SpinRequestDto,
  ): Promise<SpinResultDto> {
    return this.spinGameService.executeSpin(
      req.user.userId ?? req.user.id,
      dto,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user spin statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: UserSpinStatsDto,
    description:
      'Returns user statistics including total spins, wins, and profit',
  })
  async getStats(@Req() req: any): Promise<UserSpinStatsDto> {
    return this.spinGameService.getUserStatistics(
      req.user.userId ?? req.user.id,
    );
  }
}
