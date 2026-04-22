import { NextResponse } from 'next/server';
import { AiPredictionService } from '../../../lib/ai-prediction-service';
import { redis } from '../../../database/redis';

export async function POST(req: Request) {
  const body = await req.json();
  const { matchId, matchData } = body;

  const service = new AiPredictionService(redis);
  const prediction = await service.predictMatch(matchId, matchData);

  return NextResponse.json(prediction);
}
