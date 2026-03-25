@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ModerationLog)
    private logRepo: Repository<ModerationLog>,
  ) {}

  async log(commentId: string, adminId: string, action: string) {
    return this.logRepo.save({
      commentId,
      adminId,
      action,
    });
  }
}