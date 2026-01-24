import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1769272603000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1769272603000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // User indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_users_role" ON "users" ("role")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_status" ON "users" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email_verified" ON "users" ("email_verified")`,
    );

    // Match indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_status" ON "matches" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_start_time" ON "matches" ("start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_league" ON "matches" ("league")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_season" ON "matches" ("season")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_status_start_time" ON "matches" ("status", "start_time")`,
    );

    // Bet indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_bets_user_id" ON "bets" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bets_match_id" ON "bets" ("match_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bets_status" ON "bets" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bets_user_id_status" ON "bets" ("user_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bets_match_id_status" ON "bets" ("match_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bets_settled_at" ON "bets" ("settled_at")`,
    );

    // Prediction indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_user_id" ON "predictions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_match_id" ON "predictions" ("match_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_status" ON "predictions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_user_id_status" ON "predictions" ("user_id", "status")`,
    );

    // Post indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_status" ON "posts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_published_at" ON "posts" ("publishedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_status_published_at" ON "posts" ("status", "publishedAt")`,
    );

    // Comment indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_status" ON "comments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_parent_id" ON "comments" ("parentId")`,
    );

    // Transaction indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_id" ON "transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_type" ON "transactions" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_id_type" ON "transactions" ("user_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_id_status" ON "transactions" ("user_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_reference_id" ON "transactions" ("reference_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_related_entity_id" ON "transactions" ("related_entity_id")`,
    );

    // Settlement indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_settlement_status" ON "settlement" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_settlement_bet_id" ON "settlement" ("betId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_settlement_reference_id" ON "settlement" ("referenceId")`,
    );

    // Category indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_status" ON "categories" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_parent_id" ON "categories" ("parentId")`,
    );

    // PlayerCardMetadata indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_player_card_metadata_rarity" ON "player_card_metadata" ("rarity")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_player_card_metadata_is_published" ON "player_card_metadata" ("isPublished")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_player_card_metadata_season" ON "player_card_metadata" ("season")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_player_card_metadata_is_published_rarity" ON "player_card_metadata" ("isPublished", "rarity")`,
    );

    // Media indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_media_type" ON "media" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_status" ON "media" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_type_status" ON "media" ("type", "status")`,
    );

    // BaseEntity timestamp indexes for all tables
    const tables = [
      'users',
      'matches',
      'bets',
      'predictions',
      'posts',
      'comments',
      'transactions',
      'categories',
      'player_card_metadata',
      'media',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_created_at" ON "${table}" ("created_at")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_updated_at" ON "${table}" ("updated_at")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    const tables = [
      'users',
      'matches',
      'bets',
      'predictions',
      'posts',
      'comments',
      'transactions',
      'categories',
      'player_card_metadata',
      'media',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP INDEX "IDX_${table}_updated_at"`);
      await queryRunner.query(`DROP INDEX "IDX_${table}_created_at"`);
    }

    // Media indexes
    await queryRunner.query(`DROP INDEX "IDX_media_type_status"`);
    await queryRunner.query(`DROP INDEX "IDX_media_status"`);
    await queryRunner.query(`DROP INDEX "IDX_media_type"`);

    // PlayerCardMetadata indexes
    await queryRunner.query(
      `DROP INDEX "IDX_player_card_metadata_is_published_rarity"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_player_card_metadata_season"`);
    await queryRunner.query(
      `DROP INDEX "IDX_player_card_metadata_is_published"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_player_card_metadata_rarity"`);

    // Category indexes
    await queryRunner.query(`DROP INDEX "IDX_categories_parent_id"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_status"`);

    // Settlement indexes
    await queryRunner.query(`DROP INDEX "IDX_settlement_reference_id"`);
    await queryRunner.query(`DROP INDEX "IDX_settlement_bet_id"`);
    await queryRunner.query(`DROP INDEX "IDX_settlement_status"`);

    // Transaction indexes
    await queryRunner.query(`DROP INDEX "IDX_transactions_related_entity_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_reference_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_user_id_status"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_user_id_type"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_type"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_status"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_user_id"`);

    // Comment indexes
    await queryRunner.query(`DROP INDEX "IDX_comments_parent_id"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_status"`);

    // Post indexes
    await queryRunner.query(`DROP INDEX "IDX_posts_status_published_at"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_published_at"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_status"`);

    // Prediction indexes
    await queryRunner.query(`DROP INDEX "IDX_predictions_user_id_status"`);
    await queryRunner.query(`DROP INDEX "IDX_predictions_status"`);
    await queryRunner.query(`DROP INDEX "IDX_predictions_match_id"`);
    await queryRunner.query(`DROP INDEX "IDX_predictions_user_id"`);

    // Bet indexes
    await queryRunner.query(`DROP INDEX "IDX_bets_settled_at"`);
    await queryRunner.query(`DROP INDEX "IDX_bets_match_id_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bets_user_id_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bets_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bets_match_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bets_user_id"`);

    // Match indexes
    await queryRunner.query(`DROP INDEX "IDX_matches_status_start_time"`);
    await queryRunner.query(`DROP INDEX "IDX_matches_season"`);
    await queryRunner.query(`DROP INDEX "IDX_matches_league"`);
    await queryRunner.query(`DROP INDEX "IDX_matches_start_time"`);
    await queryRunner.query(`DROP INDEX "IDX_matches_status"`);

    // User indexes
    await queryRunner.query(`DROP INDEX "IDX_users_email_verified"`);
    await queryRunner.query(`DROP INDEX "IDX_users_status"`);
    await queryRunner.query(`DROP INDEX "IDX_users_role"`);
  }
}
