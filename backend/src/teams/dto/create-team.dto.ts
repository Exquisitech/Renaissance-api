import { IsString, IsOptional, IsNumber, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ description: 'Team name', example: 'Manchester United' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Team short name', example: 'Man Utd' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiPropertyOptional({ description: 'Team code', example: 'MUN' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiPropertyOptional({ description: 'League name', example: 'Premier League' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  league?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'England' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'Year founded', example: 1878 })
  @IsOptional()
  @IsNumber()
  founded?: number;

  @ApiPropertyOptional({ description: 'Stadium name', example: 'Old Trafford' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stadium?: string;

  @ApiPropertyOptional({ description: 'Stadium capacity', example: 74140 })
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Team website', example: 'https://www.manutd.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Team logo URL', example: 'https://example.com/logos/man-united.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', example: { colors: ['red', 'white'], nickname: 'The Red Devils' } })
  @IsOptional()
  metadata?: Record<string, any>;
}
