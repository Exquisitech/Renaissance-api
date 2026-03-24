import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddSpinTable1769263285299 implements MigrationInterface {
  name = 'AddSpinTable1769263285299';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create spins table
    await queryRunner.createTable(
      new Table({
        name: 'spins',
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
            name: 'sessionId',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'stakeAmount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'outcome',
            type: 'enum',
            enum: ['jackpot', 'high_win', 'medium_win', 'small_win', 'no_win'],
            isNullable: false,
          },
          {
            name: 'payoutAmount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'spins',
      new TableIndex({
        name: 'IDX_spins_user_id_created_at',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'spins',
      new TableIndex({
        name: 'IDX_spins_session_id',
        columnNames: ['sessionId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'spins',
      new TableIndex({
        name: 'IDX_spins_user_id',
        columnNames: ['userId'],
      }),
    );

    // Add foreign key constraint to users table
    await queryRunner.query(`
      ALTER TABLE "spins"
      ADD CONSTRAINT "FK_spins_user_id"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "spins" DROP CONSTRAINT "FK_spins_user_id"`,
    );

    // Drop indexes
    await queryRunner.dropIndex('spins', 'IDX_spins_user_id');
    await queryRunner.dropIndex('spins', 'IDX_spins_session_id');
    await queryRunner.dropIndex('spins', 'IDX_spins_user_id_created_at');

    // Drop table
    await queryRunner.dropTable('spins');
  }
}
