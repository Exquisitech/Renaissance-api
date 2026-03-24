import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddSpinSessionTable1769293685000 implements MigrationInterface {
  name = 'AddSpinSessionTable1769293685000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create reward_type enum
    await queryRunner.query(`
      CREATE TYPE "spin_session_reward_type_enum" AS ENUM ('xp', 'tokens', 'nft', 'bonus_spin', 'multiplier', 'none')
    `);

    // Create spin_session_status enum
    await queryRunner.query(`
      CREATE TYPE "spin_session_status_enum" AS ENUM ('pending', 'completed', 'failed')
    `);

    // Create spin_sessions table
    await queryRunner.createTable(
      new Table({
        name: 'spin_sessions',
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
            name: 'stakeAmount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'rewardType',
            type: 'spin_session_reward_type_enum',
            default: "'none'",
            isNullable: false,
          },
          {
            name: 'rewardValue',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'spin_session_status_enum',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'txReference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    );

    // Create composite index on userId and createdAt for efficient filtering
    await queryRunner.createIndex(
      'spin_sessions',
      new TableIndex({
        name: 'IDX_spin_sessions_user_id_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    // Create single index on userId for user-specific queries
    await queryRunner.createIndex(
      'spin_sessions',
      new TableIndex({
        name: 'IDX_spin_sessions_user_id',
        columnNames: ['userId'],
      }),
    );

    // Add foreign key constraint to users table
    await queryRunner.query(`
      ALTER TABLE "spin_sessions"
      ADD CONSTRAINT "FK_spin_sessions_user_id"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "spin_sessions" DROP CONSTRAINT "FK_spin_sessions_user_id"`,
    );

    // Drop indexes
    await queryRunner.dropIndex('spin_sessions', 'IDX_spin_sessions_user_id');
    await queryRunner.dropIndex(
      'spin_sessions',
      'IDX_spin_sessions_user_id_created_at',
    );

    // Drop table
    await queryRunner.dropTable('spin_sessions');

    // Drop enums
    await queryRunner.query(`DROP TYPE "spin_session_status_enum"`);
    await queryRunner.query(`DROP TYPE "spin_session_reward_type_enum"`);
  }
}
