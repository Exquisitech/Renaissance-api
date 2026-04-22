import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateAnalyticsEvents1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'analytics_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'eventType',
            type: 'enum',
            enum: [
              'user_login',
              'user_register',
              'bet_placed',
              'bet_settled',
              'spin_played',
              'nft_purchased',
              'prediction_made',
              'post_created',
              'comment_added',
              'achievement_unlocked',
              'wallet_transaction',
              'page_view',
              'feature_usage',
            ],
            isNullable: false,
          },
          {
            name: 'category',
            type: 'enum',
            enum: [
              'authentication',
              'gambling',
              'social',
              'nft',
              'predictions',
              'wallet',
              'engagement',
            ],
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'analytics_events',
      new Index('IDX_analytics_events_user_event_created', ['userId', 'eventType', 'createdAt']),
    );

    await queryRunner.createIndex(
      'analytics_events',
      new Index('IDX_analytics_events_event_type_created', ['eventType', 'createdAt']),
    );

    await queryRunner.createIndex(
      'analytics_events',
      new Index('IDX_analytics_events_category_created', ['category', 'createdAt']),
    );

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE analytics_events
      ADD CONSTRAINT FK_analytics_events_user
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('analytics_events');
  }
}