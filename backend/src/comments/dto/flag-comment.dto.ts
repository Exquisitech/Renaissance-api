import { IsEnum } from 'class-validator';
import { FlagReason } from '../enums/flag-reason.enum';

export class FlagCommentDto {
  @IsEnum(FlagReason)
  reason: FlagReason;
}