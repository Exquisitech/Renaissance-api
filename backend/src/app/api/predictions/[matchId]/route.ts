import { NextResponse } from 'next/server';
import { AiPredictionService } from '../../../../lib/ai-prediction-service';
import { redis } from '../../../../database/redis';

export async function GET(req: Request, { params }: { params: { matchId: string } }) {
  const { matchId } = params;

  const service = new AiPredictionService(redis);
  const matchData = await fetchMatchData(matchId); // integrate with matches module

  const prediction = await service.predictMatch(matchId, matchData);
  return NextResponse.json(prediction);
}

async function fetchMatchData(matchId: string) {
  // Placeholder: integrate with your matches DB or external API
  return { id: matchId, teams: ['Team A', 'Team B'], stats: { possession: 55, shots: 10 } };
}
