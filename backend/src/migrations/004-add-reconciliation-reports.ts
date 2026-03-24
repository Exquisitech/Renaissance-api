import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddReconciliationReports1706140000004 implements MigrationInterface {
  name = 'AddReconciliationReports1706140000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create report_status enum
    await queryRunner.query(`
      CREATE TYPE "report_status_enum" AS ENUM ('running', 'completed', 'failed')
    `);

    // Create report_type enum
    await queryRunner.query(`
      CREATE TYPE "report_type_enum" AS ENUM ('scheduled', 'manual')
    `);

    // Create reconciliation_reports table
    await queryRunner.createTable(
      new Table({
        name: 'reconciliation_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'status',
            type: 'report_status_enum',
            default: "'running'",
          },
          {
            name: 'type',
            type: 'report_type_enum',
          },
          {
            name: 'started_at',
            type: 'timestamp',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'negative_balance_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'orphaned_bet_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'mismatched_settlement_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'stuck_pending_settlement_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_inconsistencies',
            type: 'int',
            default: 0,
          },
          {
            name: 'inconsistencies',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
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
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_reconciliation_reports_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_reconciliation_reports_type',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_reconciliation_reports_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_reconciliation_reports_status_created_at',
        columnNames: ['status', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_reconciliation_reports_status_created_at',
    );
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_reconciliation_reports_created_at',
    );
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_reconciliation_reports_type',
    );
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_reconciliation_reports_status',
    );

    // Drop table
    await queryRunner.dropTable('reconciliation_reports');

    // Drop enums
    await queryRunner.query(`DROP TYPE "report_type_enum"`);
    await queryRunner.query(`DROP TYPE "report_status_enum"`);
  }
}
