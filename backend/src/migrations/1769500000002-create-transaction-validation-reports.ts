import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class CreateTransactionValidationReports1769500000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transaction_validation_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'passed', 'failed', 'rolled_back'],
            default: "'pending'",
          },
          {
            name: 'transaction_type',
            type: 'enum',
            enum: [
              'bet_settlement',
              'spin_payout',
              'staking_reward',
              'staking_penalty',
              'wallet_transfer',
            ],
          },
          {
            name: 'validation_type',
            type: 'enum',
            enum: [
              'balance_integrity',
              'state_consistency',
              'atomicity_check',
              'onchain_reconciliation',
            ],
          },
          {
            name: 'transaction_id',
            type: 'varchar',
          },
          {
            name: 'reference_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'varchar',
            isNullable: true,
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
            name: 'validation_rules',
            type: 'json',
          },
          {
            name: 'validation_results',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'violations',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'total_checks',
            type: 'int',
            default: 0,
          },
          {
            name: 'passed_checks',
            type: 'int',
            default: 0,
          },
          {
            name: 'failed_checks',
            type: 'int',
            default: 0,
          },
          {
            name: 'critical_violations',
            type: 'int',
            default: 0,
          },
          {
            name: 'rollback_triggered',
            type: 'boolean',
            default: false,
          },
          {
            name: 'rollback_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rollback_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
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
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'transaction_validation_reports',
      new TableIndex({
        name: 'IDX_TX_VALIDATION_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'transaction_validation_reports',
      new TableIndex({
        name: 'IDX_TX_VALIDATION_TYPE',
        columnNames: ['transaction_type'],
      }),
    );

    await queryRunner.createIndex(
      'transaction_validation_reports',
      new TableIndex({
        name: 'IDX_TX_VALIDATION_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transaction_validation_reports',
      new TableIndex({
        name: 'IDX_TX_VALIDATION_STATUS_CREATED',
        columnNames: ['status', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transaction_validation_reports',
      new TableIndex({
        name: 'IDX_TX_VALIDATION_VALIDATION_TYPE',
        columnNames: ['validation_type'],
      }),
    );

    await queryRunner.createIndex(
      'transaction_validation_reports',
      new TableIndex({
        name: 'IDX_TX_VALIDATION_TRANSACTION_ID',
        columnNames: ['transaction_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'transaction_validation_reports',
      'IDX_TX_VALIDATION_STATUS',
    );
    await queryRunner.dropIndex(
      'transaction_validation_reports',
      'IDX_TX_VALIDATION_TYPE',
    );
    await queryRunner.dropIndex(
      'transaction_validation_reports',
      'IDX_TX_VALIDATION_CREATED_AT',
    );
    await queryRunner.dropIndex(
      'transaction_validation_reports',
      'IDX_TX_VALIDATION_STATUS_CREATED',
    );
    await queryRunner.dropIndex(
      'transaction_validation_reports',
      'IDX_TX_VALIDATION_VALIDATION_TYPE',
    );
    await queryRunner.dropIndex(
      'transaction_validation_reports',
      'IDX_TX_VALIDATION_TRANSACTION_ID',
    );

    // Drop table
    await queryRunner.dropTable('transaction_validation_reports');
  }
}
