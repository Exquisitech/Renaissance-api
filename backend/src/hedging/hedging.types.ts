// hedging.types.ts

export enum BetSide {
  BACK = 'back', // betting for outcome
  LAY = 'lay',   // betting against outcome
}

export interface HedgeResult {
  originalBetId: string;
  hedgeBetId: string;
  effectiveness: number;
}