@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,

    @InjectRepository(CommentFlag)
    private flagRepo: Repository<CommentFlag>,
  ) {}

  // ✅ Flag comment
  async flagComment(commentId: string, userId: string, reason: string) {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });

    if (!comment) throw new Error('Comment not found');

    await this.flagRepo.save({
      commentId,
      userId,
      reason,
    });

    comment.flagCount += 1;

    // 🔥 Auto moderation trigger
    if (comment.flagCount >= 3) {
      comment.status = CommentStatus.PENDING;
    }

    return this.commentRepo.save(comment);
  }

  // ✅ User comment history
  async getUserComments(userId: string) {
    return this.commentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}