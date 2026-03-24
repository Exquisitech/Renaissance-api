import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { TriggerEvent, RuleType } from '../entities/achievement.entity';

export class CreateAchievementDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TriggerEvent)
  triggerEvent: TriggerEvent;

  @IsEnum(RuleType)
  ruleType: RuleType;

  @IsNumber()
  targetValue: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsNumber()
  @IsOptional()
  rewardPoints?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
