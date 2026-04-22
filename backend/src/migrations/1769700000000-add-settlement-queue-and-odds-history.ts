import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettlementQueueAndOddsHistory1769700000000
  implements MigrationInterface
{
  name = 'AddSettlementQueueAndOddsHistory1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."bet_settlement_jobs_status_enum"
      AS ENUM('pending', 'processing', 'completed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TABLE "bet_settlement_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "match_id" uuid NOT NULL,
        "status" "public"."bet_settlement_jobs_status_enum" NOT NULL DEFAULT 'pending',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 5,
        "next_retry_at" TIMESTAMP,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "last_error" text,
        "requested_by" character varying,
        "last_summary" json,
        "metadata" json,
        CONSTRAINT "PK_bet_settlement_jobs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_jobs_match_id"
      ON "bet_settlement_jobs" ("match_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_jobs_status"
      ON "bet_settlement_jobs" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_jobs_status_next_retry_at"
      ON "bet_settlement_jobs" ("status", "next_retry_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_jobs_match_status"
      ON "bet_settlement_jobs" ("match_id", "status")
    `);
    await queryRunner.query(`
      ALTER TABLE "bet_settlement_jobs"
      ADD CONSTRAINT "FK_bet_settlement_jobs_match_id"
      FOREIGN KEY ("match_id") REFERENCES "matches"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."bet_settlement_audit_logs_action_enum"
      AS ENUM(
        'enqueued',
        'skipped',
        'processing_started',
        'completed',
        'retry_scheduled',
        'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "bet_settlement_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "job_id" uuid,
        "match_id" uuid NOT NULL,
        "action" "public"."bet_settlement_audit_logs_action_enum" NOT NULL,
        "message" character varying,
        "attempt" integer,
        "error_message" text,
        "metadata" json,
        CONSTRAINT "PK_bet_settlement_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_audit_logs_job_id"
      ON "bet_settlement_audit_logs" ("job_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_audit_logs_match_id"
      ON "bet_settlement_audit_logs" ("match_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_audit_logs_action"
      ON "bet_settlement_audit_logs" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bet_settlement_audit_logs_created_at"
      ON "bet_settlement_audit_logs" ("created_at")
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."match_odds_history_source_enum"
      AS ENUM('manual', 'automatic', 'match_update')
    `);
    await queryRunner.query(`
      CREATE TABLE "match_odds_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "match_id" uuid NOT NULL,
        "previous_home_odds" numeric(5,2) NOT NULL,
        "previous_draw_odds" numeric(5,2) NOT NULL,
        "previous_away_odds" numeric(5,2) NOT NULL,
        "new_home_odds" numeric(5,2) NOT NULL,
        "new_draw_odds" numeric(5,2) NOT NULL,
        "new_away_odds" numeric(5,2) NOT NULL,
        "source" "public"."match_odds_history_source_enum" NOT NULL,
        "changed_by_user_id" character varying,
        "reason" character varying,
        "metadata" json,
        CONSTRAINT "PK_match_odds_history_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_match_odds_history_match_id"
      ON "match_odds_history" ("match_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_match_odds_history_match_created_at"
      ON "match_odds_history" ("match_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_match_odds_history_source"
      ON "match_odds_history" ("source")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_match_odds_history_source"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_match_odds_history_match_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_match_odds_history_match_id"`);
    await queryRunner.query(`DROP TABLE "match_odds_history"`);
    await queryRunner.query(`DROP TYPE "public"."match_odds_history_source_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_audit_logs_match_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_audit_logs_job_id"`);
    await queryRunner.query(`DROP TABLE "bet_settlement_audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."bet_settlement_audit_logs_action_enum"`);

    await queryRunner.query(`
      ALTER TABLE "bet_settlement_jobs"
      DROP CONSTRAINT "FK_bet_settlement_jobs_match_id"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_jobs_match_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_jobs_status_next_retry_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_jobs_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bet_settlement_jobs_match_id"`);
    await queryRunner.query(`DROP TABLE "bet_settlement_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."bet_settlement_jobs_status_enum"`);
  }
}
