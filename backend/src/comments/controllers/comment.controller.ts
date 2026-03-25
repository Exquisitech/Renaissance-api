@Controller('comments')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly moderationService: ModerationService,
  ) {}

  @Post(':id/flag')
  flag(@Param('id') id: string, @Body() dto: FlagCommentDto) {
    const userId = 'mock-user';
    return this.commentService.flagComment(id, userId, dto.reason);
  }

  @Get('moderation-queue')
  getQueue() {
    return this.moderationService.getModerationQueue();
  }

  @Post(':id/moderate')
  moderate(@Param('id') id: string, @Body() dto: ModerateCommentDto) {
    const adminId = 'mock-admin';
    return this.moderationService.moderate(id, adminId, dto.action);
  }

  @Get('user-history')
  history() {
    const userId = 'mock-user';
    return this.commentService.getUserComments(userId);
  }
}