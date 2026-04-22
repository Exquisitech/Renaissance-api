/**
 * match_settlement.ts
 * Express endpoints to settle match results and distribute staking rewards.
 *
 * Assumed stack:
 *   - Express + TypeScript
 *   - Prisma ORM (replace with your adapter)
 *   - StellarService from stellar_service.ts
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  StellarService,
  StellarServiceError,
} from 'src/stellar/stellar.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchResult {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: 'home_win' | 'away_win' | 'draw';
  settledAt: Date;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedOutcome: 'home_win' | 'away_win' | 'draw';
  stakeAmount: bigint; // in stroops / smallest token unit
  rewardMultiplier: number; // e.g. 1.8 for 80% return
  status: 'pending' | 'won' | 'lost' | 'refunded' | 'settled';
}

export interface RewardCalculation {
  predictionId: string;
  userId: string;
  stakeAmount: bigint;
  rewardAmount: bigint;
  isWinner: boolean;
  isRefund: boolean;
}

export interface SettlementAuditEntry {
  matchId: string;
  settledAt: Date;
  totalPredictions: number;
  winners: number;
  losers: number;
  refunds: number;
  totalRewarded: bigint;
  totalRefunded: bigint;
  txHashes: string[];
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REFUND_OUTCOMES = new Set(['cancelled', 'postponed', 'abandoned']);
const MAX_BATCH_SIZE = 50; // predictions settled per batch tx
const MIN_STAKE = 100_000n; // 0.01 XLM in stroops

// ─── Router factory ────────────────────────────────────────────────────────────

export function createSettlementRouter(
  prisma: PrismaClient,
  stellar: StellarService,
  adminPublicKey: string,
): Router {
  const router = Router();

  // ── POST /api/matches/:matchId/settle ─────────────────────────────────────

  /**
   * Trigger settlement for a completed match.
   * Body: { homeScore: number, awayScore: number, forceRefund?: boolean }
   *
   * This endpoint:
   *   1. Fetches the final result (from body or external oracle)
   *   2. Identifies winning predictions
   *   3. Calculates rewards
   *   4. Distributes on-chain
   *   5. Handles ties/refunds
   *   6. Updates DB and writes audit trail
   */
  router.post(
    '/matches/:matchId/settle',
    asyncHandler(async (req: Request, res: Response) => {
      const { matchId } = req.params;
      const {
        homeScore,
        awayScore,
        forceRefund = false,
      } = req.body as {
        homeScore: number;
        awayScore: number;
        forceRefund?: boolean;
      };

      if (homeScore === undefined || awayScore === undefined) {
        return res
          .status(400)
          .json({ error: 'homeScore and awayScore are required' });
      }

      // Check match exists and is not already settled
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) return res.status(404).json({ error: 'Match not found' });
      if (match.settled)
        return res.status(409).json({ error: 'Match already settled' });

      // Determine outcome
      const outcome: MatchResult['status'] = forceRefund
        ? 'draw' // dummy — will be treated as refund
        : homeScore > awayScore
          ? 'home_win'
          : awayScore > homeScore
            ? 'away_win'
            : 'draw';

      const matchResult: MatchResult = {
        matchId,
        homeScore,
        awayScore,
        status: outcome,
        settledAt: new Date(),
      };

      // Run settlement in a DB transaction
      const settlement = await settleMatch(
        prisma,
        stellar,
        adminPublicKey,
        matchResult,
        forceRefund,
      );

      // Write audit trail
      await prisma.settlementAudit.create({
        data: {
          matchId,
          settledAt: settlement.settledAt,
          totalPredictions: settlement.totalPredictions,
          winners: settlement.winners,
          losers: settlement.losers,
          refunds: settlement.refunds,
          totalRewarded: settlement.totalRewarded.toString(),
          totalRefunded: settlement.totalRefunded.toString(),
          txHashes: settlement.txHashes,
          errors: settlement.errors,
        },
      });

      return res.json({
        success: true,
        matchId,
        outcome,
        settlement: {
          ...settlement,
          totalRewarded: settlement.totalRewarded.toString(),
          totalRefunded: settlement.totalRefunded.toString(),
        },
      });
    }),
  );

  // ── GET /api/matches/:matchId/settlement ──────────────────────────────────

  router.get(
    '/matches/:matchId/settlement',
    asyncHandler(async (req: Request, res: Response) => {
      const { matchId } = req.params;

      const audit = await prisma.settlementAudit.findFirst({
        where: { matchId },
        orderBy: { settledAt: 'desc' },
      });

      if (!audit)
        return res.status(404).json({ error: 'No settlement record found' });

      return res.json(audit);
    }),
  );

  // ── GET /api/users/:userId/rewards ────────────────────────────────────────

  router.get(
    '/users/:userId/rewards',
    asyncHandler(async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { page = '1', limit = '20' } = req.query as Record<string, string>;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [predictions, total] = await Promise.all([
        prisma.prediction.findMany({
          where: { userId, status: { in: ['won', 'refunded'] } },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.prediction.count({
          where: { userId, status: { in: ['won', 'refunded'] } },
        }),
      ]);

      const totalWon = predictions
        .filter((p) => p.status === 'won')
        .reduce((acc, p) => acc + BigInt(p.rewardAmount ?? 0), 0n);

      return res.json({
        predictions,
        totalWon: totalWon.toString(),
        pagination: { page: parseInt(page), limit: parseInt(limit), total },
      });
    }),
  );

  // ── POST /api/matches/:matchId/refund ─────────────────────────────────────

  /**
   * Force-refund all stakes for a match (cancelled/abandoned).
   */
  router.post(
    '/matches/:matchId/refund',
    asyncHandler(async (req: Request, res: Response) => {
      const { matchId } = req.params;

      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) return res.status(404).json({ error: 'Match not found' });
      if (match.settled)
        return res.status(409).json({ error: 'Match already settled' });

      const refundResult = await processRefunds(
        prisma,
        stellar,
        adminPublicKey,
        matchId,
      );

      return res.json({ success: true, matchId, ...refundResult });
    }),
  );

  return router;
}

// ─── Core settlement logic ────────────────────────────────────────────────────

async function settleMatch(
  prisma: PrismaClient,
  stellar: StellarService,
  adminPublicKey: string,
  result: MatchResult,
  forceRefund: boolean,
): Promise<SettlementAuditEntry> {
  const { matchId, status } = result;

  // 1. Fetch all pending predictions for this match
  const predictions: Prediction[] = (await prisma.prediction.findMany({
    where: { matchId, status: 'pending' },
  })) as unknown as Prediction[];

  const audit: SettlementAuditEntry = {
    matchId,
    settledAt: result.settledAt,
    totalPredictions: predictions.length,
    winners: 0,
    losers: 0,
    refunds: 0,
    totalRewarded: 0n,
    totalRefunded: 0n,
    txHashes: [],
    errors: [],
  };

  if (predictions.length === 0) {
    await prisma.match.update({
      where: { id: matchId },
      data: { settled: true },
    });
    return audit;
  }

  // 2. Categorise predictions
  const rewards: RewardCalculation[] = [];

  for (const pred of predictions) {
    if (forceRefund || REFUND_OUTCOMES.has(status)) {
      rewards.push({
        predictionId: pred.id,
        userId: pred.userId,
        stakeAmount: pred.stakeAmount,
        rewardAmount: pred.stakeAmount, // full refund
        isWinner: false,
        isRefund: true,
      });
      audit.refunds++;
      audit.totalRefunded += pred.stakeAmount;
    } else {
      const won = pred.predictedOutcome === status;
      if (won) {
        const reward = calculateReward(pred.stakeAmount, pred.rewardMultiplier);
        rewards.push({
          predictionId: pred.id,
          userId: pred.userId,
          stakeAmount: pred.stakeAmount,
          rewardAmount: reward,
          isWinner: true,
          isRefund: false,
        });
        audit.winners++;
        audit.totalRewarded += reward;
      } else {
        // Loser — no distribution, just mark in DB
        rewards.push({
          predictionId: pred.id,
          userId: pred.userId,
          stakeAmount: pred.stakeAmount,
          rewardAmount: 0n,
          isWinner: false,
          isRefund: false,
        });
        audit.losers++;
      }
    }
  }

  // 3. Distribute on-chain in batches
  const distributable = rewards.filter((r) => r.rewardAmount > 0n);
  const batches = chunk(distributable, MAX_BATCH_SIZE);

  for (const batch of batches) {
    const batchResult = await distributeRewardsBatch(
      stellar,
      adminPublicKey,
      batch,
    );
    audit.txHashes.push(...batchResult.txHashes);
    audit.errors.push(...batchResult.errors);
  }

  // 4. Update DB in a transaction
  await prisma.$transaction(async (tx) => {
    for (const r of rewards) {
      await tx.prediction.update({
        where: { id: r.predictionId },
        data: {
          status: r.isRefund ? 'refunded' : r.isWinner ? 'won' : 'lost',
          rewardAmount: r.rewardAmount.toString(),
          settledAt: result.settledAt,
        },
      });

      // Update user balance record
      if (r.rewardAmount > 0n) {
        await tx.userBalance.upsert({
          where: { userId: r.userId },
          update: {
            pendingRewards: {
              increment: r.rewardAmount.toString() as unknown as number,
            },
          },
          create: {
            userId: r.userId,
            pendingRewards: r.rewardAmount.toString(),
            totalEarned: r.rewardAmount.toString(),
          },
        });
      }
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        settled: true,
        outcome: result.status,
        settledAt: result.settledAt,
      },
    });
  });

  return audit;
}

// ─── Reward calculation ───────────────────────────────────────────────────────

function calculateReward(stakeAmount: bigint, multiplier: number): bigint {
  // Apply multiplier with 4-decimal precision to avoid float drift
  const multiplierBasis = BigInt(Math.round(multiplier * 10_000));
  return (stakeAmount * multiplierBasis) / 10_000n;
}

// ─── On-chain distribution ────────────────────────────────────────────────────

async function distributeRewardsBatch(
  stellar: StellarService,
  adminPublicKey: string,
  batch: RewardCalculation[],
): Promise<{ txHashes: string[]; errors: string[] }> {
  const txHashes: string[] = [];
  const errors: string[] = [];

  for (const reward of batch) {
    try {
      // Resolve user's Stellar public key from DB
      // (In a real app, look up the user's linked wallet address)
      const userWalletAddress = await resolveUserWallet(reward.userId);

      if (!userWalletAddress) {
        errors.push(`No wallet for user ${reward.userId}`);
        continue;
      }

      if (reward.rewardAmount < MIN_STAKE) {
        errors.push(
          `Reward too small for ${reward.userId}: ${reward.rewardAmount}`,
        );
        continue;
      }

      // Send native XLM reward (adapt for token rewards if needed)
      const stroopsToXlm = (Number(reward.rewardAmount) / 10_000_000).toFixed(
        7,
      );

      const result = await stellar.sendNativePayment(
        adminPublicKey,
        userWalletAddress,
        stroopsToXlm,
        `Reward: pred ${reward.predictionId}`,
      );

      if (result.success) {
        txHashes.push(result.hash);
        console.log(
          `✅ Paid ${stroopsToXlm} XLM to ${userWalletAddress} [${result.hash}]`,
        );
      } else {
        errors.push(`Payment failed for ${reward.userId}: ${result.error}`);
      }
    } catch (err) {
      const msg =
        err instanceof StellarServiceError ? err.message : String(err);
      errors.push(`Error distributing to ${reward.userId}: ${msg}`);
    }
  }

  return { txHashes, errors };
}

// ─── Refund processing ────────────────────────────────────────────────────────

async function processRefunds(
  prisma: PrismaClient,
  stellar: StellarService,
  adminPublicKey: string,
  matchId: string,
): Promise<Omit<SettlementAuditEntry, 'matchId' | 'settledAt'>> {
  const predictions = (await prisma.prediction.findMany({
    where: { matchId, status: 'pending' },
  })) as unknown as Prediction[];

  const refunds: RewardCalculation[] = predictions.map((p) => ({
    predictionId: p.id,
    userId: p.userId,
    stakeAmount: p.stakeAmount,
    rewardAmount: p.stakeAmount,
    isWinner: false,
    isRefund: true,
  }));

  const result = await distributeRewardsBatch(stellar, adminPublicKey, refunds);

  const totalRefunded = refunds.reduce((acc, r) => acc + r.rewardAmount, 0n);

  // Update DB
  await prisma.$transaction([
    ...predictions.map((p) =>
      prisma.prediction.update({
        where: { id: p.id },
        data: {
          status: 'refunded',
          rewardAmount: p.stakeAmount.toString(),
          settledAt: new Date(),
        },
      }),
    ),
    prisma.match.update({
      where: { id: matchId },
      data: { settled: true, outcome: 'refunded', settledAt: new Date() },
    }),
  ]);

  return {
    totalPredictions: predictions.length,
    winners: 0,
    losers: 0,
    refunds: predictions.length,
    totalRewarded: 0n,
    totalRefunded,
    txHashes: result.txHashes,
    errors: result.errors,
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Placeholder — replace with your real user ↔ wallet lookup */
async function resolveUserWallet(userId: string): Promise<string | null> {
  // e.g. return prisma.user.findUnique({ where: { id: userId } }).then(u => u?.stellarAddress ?? null)
  return null;
}

function asyncHandler(
  fn: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<Response | void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ─── Error middleware (mount this last in your Express app) ───────────────────

export function settlementErrorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[SettlementError]', err);

  if (err instanceof StellarServiceError) {
    res.status(502).json({ error: 'Blockchain error', detail: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(500).json({ error: 'Database error', code: err.code });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}

// ─── Prisma schema reference (add to schema.prisma) ──────────────────────────
/*
model Match {
  id          String    @id @default(cuid())
  homeTeam    String
  awayTeam    String
  scheduledAt DateTime
  settled     Boolean   @default(false)
  outcome     String?
  settledAt   DateTime?
  predictions Prediction[]
}

model Prediction {
  id               String    @id @default(cuid())
  userId           String
  matchId          String
  match            Match     @relation(fields: [matchId], references: [id])
  predictedOutcome String
  stakeAmount      String    // stored as string to preserve bigint precision
  rewardMultiplier Float
  rewardAmount     String?
  status           String    @default("pending")
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  settledAt        DateTime?
}

model UserBalance {
  id             String @id @default(cuid())
  userId         String @unique
  pendingRewards String @default("0")
  totalEarned    String @default("0")
}

model SettlementAudit {
  id               String   @id @default(cuid())
  matchId          String
  settledAt        DateTime
  totalPredictions Int
  winners          Int
  losers           Int
  refunds          Int
  totalRewarded    String
  totalRefunded    String
  txHashes         String[]
  errors           String[]
}
*/

// ─── Express app wiring example ───────────────────────────────────────────────
/*
import express from "express";
import { PrismaClient } from "@prisma/client";
import { createStellarService } from "./stellar_service";
import { createSettlementRouter, settlementErrorMiddleware } from "./match_settlement";

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const stellar = createStellarService({
  network: "testnet",
  contractId: "CXXX...",
  spinTokenId: "CYYY...",
});
stellar.connectWithSecret(process.env.ADMIN_SECRET_KEY!);

const ADMIN_PK = stellar.getPublicKey();

app.use("/api", createSettlementRouter(prisma, stellar, ADMIN_PK));
app.use(settlementErrorMiddleware);

app.listen(3000, () => console.log("Settlement API running on :3000"));
*/
