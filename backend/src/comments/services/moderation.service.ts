@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,

    private auditService: AuditService,
  ) {}

  // ✅ Admin queue
  async getModerationQueue() {
    return this.commentRepo.find({
      where: { status: CommentStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  // ✅ Moderate comment
  async moderate(commentId: string, adminId: string, action: string) {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });

    if (!comment) throw new Error('Comment not found');

    if (action === 'approve') {
      comment.status = CommentStatus.ACTIVE;
    } else if (action === 'remove') {
      comment.status = CommentStatus.REMOVED;
    }

    await this.auditService.log(commentId, adminId, action);

    return this.commentRepo.save(comment);
  }
}