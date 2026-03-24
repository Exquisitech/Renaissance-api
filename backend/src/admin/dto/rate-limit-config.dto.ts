import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class UpdateRateLimitCooldownDto {
  @ApiProperty({
    description:
      'Cooldown period in seconds between spin/stake actions per user',
    example: 5,
    minimum: 0,
    maximum: 3600,
  })
  @IsInt()
  @Min(0)
  @Max(3600)
  cooldownSeconds: number;
}
