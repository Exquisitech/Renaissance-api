import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BroadcastEventDto {
  @ApiProperty({ description: 'Event name (e.g. "bet:settled", "odds:update")' })
  @IsString()
  event: string;

  @ApiProperty({ description: 'Event payload' })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Target room. Omit to broadcast to all. Use "match:{id}" or "leaderboard".',
  })
  @IsOptional()
  @IsString()
  room?: string;
}
