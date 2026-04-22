import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeMatchDto {
  @ApiProperty({ description: 'Match UUID to subscribe to' })
  @IsString()
  matchId: string;
}
