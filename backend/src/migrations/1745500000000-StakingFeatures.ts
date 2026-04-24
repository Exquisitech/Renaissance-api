import { MigrationInterface, QueryRunner } from 'typeorm';

export class StakingFeatures1745500000000 implements MigrationInterface {
  name = 'StakingFeatures1745500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // #357: staking_tiers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staking_tiers" (
        "id"                   uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lockDays"             integer NOT NULL,
        "apr"                  numeric(5,4) NOT NULL,
        "earlyUnstakePenalty"  numeric(5,4) NOT NULL DEFAULT 0.05,
        "active"               boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_staking_tiers" PRIMARY KEY ("id")
      )
    `);

    // Seed default tiers
    await queryRunner.query(`
      INSERT INTO "staking_tiers" ("lockDays", "apr", "earlyUnstakePenalty") VALUES
        (30,  0.12, 0.05),
        (90,  0.15, 0.08),
        (180, 0.20, 0.10),
        (365, 0.25, 0.15)
      ON CONFLICT DO NOTHING
    `);

    // #356: stake_delegations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stake_delegations" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "delegatorId"   uuid NOT NULL,
        "delegateeId"   uuid NOT NULL,
        "amount"        numeric(18,6) NOT NULL,
        "active"        boolean NOT NULL DEFAULT true,
        "earnedRewards" numeric(18,6) NOT NULL DEFAULT 0,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stake_delegations" PRIMARY KEY ("id")
      )
    `);

    // #357 + #358: new columns on stakes
    await queryRunner.query(`ALTER TABLE "stakes" ADD COLUMN IF NOT EXISTS "lockDays"    integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "stakes" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "stakes" ADD COLUMN IF NOT EXISTS "apr"         numeric(5,4) NOT NULL DEFAULT 0.12`);
    await queryRunner.query(`ALTER TABLE "stakes" ADD COLUMN IF NOT EXISTS "autoCompound" boolean NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stakes" DROP COLUMN IF EXISTS "autoCompound"`);
    await queryRunner.query(`ALTER TABLE "stakes" DROP COLUMN IF EXISTS "apr"`);
    await queryRunner.query(`ALTER TABLE "stakes" DROP COLUMN IF EXISTS "lockedUntil"`);
    await queryRunner.query(`ALTER TABLE "stakes" DROP COLUMN IF EXISTS "lockDays"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stake_delegations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staking_tiers"`);
  }
}
