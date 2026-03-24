import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ProgressDto } from '../common/dto/progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get user progress',
    description: 'Aggregates and returns achievement progress for a user.',
  })
  @ApiParam({ name: 'userId', required: true })
  @ApiResponse({ status: 200, type: ProgressDto })
  async getProgress(@Param('userId') userId: string): Promise<ProgressDto> {
    return this.progressService.getUserProgress(userId);
  }
}
