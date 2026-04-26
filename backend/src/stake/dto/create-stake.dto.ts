import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class CreateStakeDto {
  @ApiPropertyOptional({
    description: 'Player ID to stake for',
    example: '456e7890-e12b-34d5-a678-901234567890',
  })
  @IsUUID()
  @IsOptional()
  playerId?: string;
}
