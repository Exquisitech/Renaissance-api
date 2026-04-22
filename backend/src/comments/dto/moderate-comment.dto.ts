import { IsIn } from 'class-validator';

export class ModerateCommentDto {
  @IsIn(['approve', 'remove'])
  action: 'approve' | 'remove';
}