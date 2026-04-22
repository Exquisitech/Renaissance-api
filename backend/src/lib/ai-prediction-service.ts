import GrokAI from 'grok-ai-sdk'; // hypothetical SDK
import { RedisService } from '../database/redis.service';

export class AiPredictionService {
  private client: GrokAI;

  constructor(private readonly redis: RedisService) {
    this.client = new GrokAI({ apiKey: process.env.GROK_API_KEY });
  }

  async predictMatch(matchId: string, matchData: any) {
    const cacheKey = `prediction:${matchId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.client.analyze({
      input: matchData,
      tasks: ['predict_outcome', 'confidence_score', 'reasoning'],
    });

    const prediction = {
      matchId,
      outcome: response.outcome,
      confidence: response.confidence,
      reasoning: response.reasoning,
      generatedAt: new Date().toISOString(),
    };

    await this.redis.set(cacheKey, JSON.stringify(prediction), 'EX', 3600);
    return prediction;
  }
}
