import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractEventListenerState1769600000000 implements MigrationInterface {
  name = 'AddContractEventListenerState1769600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_event_type_enum') THEN
          CREATE TYPE "contract_event_type_enum" AS ENUM (
            'staking',
            'spin_reward',
            'nft_mint',
            'bet_settlement',
            'unknown'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_event_status_enum') THEN
          CREATE TYPE "contract_event_status_enum" AS ENUM (
            'pending',
            'processed',
            'skipped',
            'failed'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_event_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP,
        "event_id" character varying(128) NOT NULL,
        "event_type" "contract_event_type_enum" NOT NULL DEFAULT 'unknown',
        "ledger" integer NOT NULL,
        "tx_hash" character varying(128),
        "cursor" character varying(255),
        "topics" jsonb,
        "payload" jsonb,
        "status" "contract_event_status_enum" NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "processed_at" TIMESTAMP,
        CONSTRAINT "PK_contract_event_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contract_event_logs_event_id" UNIQUE ("event_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_event_logs_event_type"
      ON "contract_event_logs" ("event_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_event_logs_status"
      ON "contract_event_logs" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_event_logs_ledger"
      ON "contract_event_logs" ("ledger")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_event_logs_tx_hash"
      ON "contract_event_logs" ("tx_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_event_logs_created_at"
      ON "contract_event_logs" ("created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_event_checkpoints" (
        "id" character varying(64) NOT NULL,
        "cursor" character varying(255),
        "last_ledger" integer NOT NULL DEFAULT 0,
        "last_polled_at" TIMESTAMP,
        "last_event_at" TIMESTAMP,
        "reconnect_count" integer NOT NULL DEFAULT 0,
        "total_processed" bigint NOT NULL DEFAULT 0,
        "total_skipped" bigint NOT NULL DEFAULT 0,
        "total_failed" bigint NOT NULL DEFAULT 0,
        "last_error" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_contract_event_checkpoints_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_event_checkpoints_last_ledger"
      ON "contract_event_checkpoints" ("last_ledger")
    `);

    await queryRunner.query(`
      INSERT INTO "contract_event_checkpoints" ("id", "last_ledger")
      VALUES ('soroban_contract_listener', 0)
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "contract_event_checkpoints"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_event_logs"`);
    await queryRunner.query(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_event_status_enum') THEN
           DROP TYPE "contract_event_status_enum";
         END IF;
       END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_event_type_enum') THEN
           DROP TYPE "contract_event_type_enum";
         END IF;
       END $$;`,
    );
  }
}
