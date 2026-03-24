// reward-listener.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NFTService } from './nft.service';
import { RewardType } from './nft.entity';

@Injectable()
export class RewardListenerService {
  private readonly logger = new Logger(RewardListenerService.name);

  constructor(
    private nftService: NFTService,
    private eventEmitter: EventEmitter2,
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for various reward events
    this.eventEmitter.on('user.bet.won', this.handleBetWin.bind(this));
    this.eventEmitter.on('user.match.attended', this.handleMatchAttendance.bind(this));
    this.eventEmitter.on('user.prediction.correct', this.handleCorrectPrediction.bind(this));
    this.eventEmitter.on('user.referral.completed', this.handleReferral.bind(this));
    this.eventEmitter.on('user.content.created', this.handleContentCreation.bind(this));
  }

  private async handleBetWin(payload: { userId: string; betId: string; amount: number }) {
    this.logger.log(`Handling bet win for user ${payload.userId}`);
    
    await this.nftService.mintNFTForReward({
      userId: payload.userId,
      rewardType: RewardType.BETTING_WIN,
      metadata: {
        betId: payload.betId,
        amount: payload.amount,
      },
      value: Math.min(Math.floor(payload.amount / 10), 100), // Scale value based on bet amount
    });
  }

  private async handleMatchAttendance(payload: { userId: string; matchId: string; teamId: string }) {
    await this.nftService.mintNFTForReward({
      userId: payload.userId,
      rewardType: RewardType.MATCH_ATTENDANCE,
      matchId: payload.matchId,
      playerId: payload.teamId, // Using teamId as playerId for team-specific cards
      value: 10,
    });
  }

  private async handleCorrectPrediction(payload: { userId: string; predictionId: string; accuracy: number }) {
    await this.nftService.mintNFTForReward({
      userId: payload.userId,
      rewardType: RewardType.PREDICTION_CORRECT,
      metadata: {
        predictionId: payload.predictionId,
        accuracy: payload.accuracy,
      },
      value: payload.accuracy * 100, // Scale value based on prediction accuracy
    });
  }

  private async handleReferral(payload: { userId: string; referredUserId: string }) {
    await this.nftService.mintNFTForReward({
      userId: payload.userId,
      rewardType: RewardType.REFERRAL,
      metadata: {
        referredUserId: payload.referredUserId,
      },
      value: 30,
    });
  }

  private async handleContentCreation(payload: { userId: string; contentId: string; contentType: string }) {
    await this.nftService.mintNFTForReward({
      userId: payload.userId,
      rewardType: RewardType.CONTENT_CREATION,
      metadata: {
        contentId: payload.contentId,
        contentType: payload.contentType,
      },
      value: 40,
    });
  }
}