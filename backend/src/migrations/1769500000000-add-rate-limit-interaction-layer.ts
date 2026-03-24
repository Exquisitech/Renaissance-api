import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rate-Limited Interaction Layer (#103)
 * - user_last_interaction: last interaction timestamp per user (spin & staking)
 * - rate_limit_config: admin-configurable cooldown period
 */
export class AddRateLimitInteractionLayer1769500000000 implements MigrationInterface {
  name = 'AddRateLimitInteractionLayer1769500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_last_interaction" (
        "user_id" uuid NOT NULL,
        "last_interaction_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_user_last_interaction_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_user_last_interaction_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "rate_limit_config" (
        "key" character varying(64) NOT NULL,
        "value_seconds" integer NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_by" character varying(64),
        CONSTRAINT "PK_rate_limit_config_key" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "rate_limit_config" ("key", "value_seconds")
      VALUES ('interaction_cooldown_seconds', 5)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_last_interaction"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_limit_config"`);
  }
}
