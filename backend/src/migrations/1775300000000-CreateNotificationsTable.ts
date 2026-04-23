import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateNotificationsTable1775300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
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
            name: 'type',
            type: 'enum',
            enum: [
              'bet_outcome',
              'spin_reward',
              'leaderboard_position_change',
              'stake_reward',
              'nft_mint',
              'account_update',
              'system_announcement',
            ],
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'read',
            type: 'boolean',
            default: false,
          },
          {
            name: 'priority',
            type: 'varchar',
            default: "'medium'",
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_notifications_user_read_created', [
        'userId',
        'read',
        'created_at',
      ]),
    );
    await queryRunner.createIndex(
      'notifications',
      new Index('IDX_notifications_type_created', ['type', 'created_at']),
    );
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT FK_notifications_user
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications');
  }
}
