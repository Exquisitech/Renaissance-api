export class AchievementUnlockedEvent {
  constructor(
    public readonly userId: string,
    public readonly achievementId: string,
    public readonly achievementName: string,
    public readonly rewardPoints: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}
