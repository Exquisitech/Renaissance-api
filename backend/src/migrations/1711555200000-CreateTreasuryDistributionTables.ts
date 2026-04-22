import { MigrationInterface, QueryRunner, Table, TableEnum } from 'typeorm';

export class CreateTreasuryDistributionTables1711555200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create distribution_status enum
    await queryRunner.createEnum(
      new TableEnum({
        name: 'distribution_status',
        values: ['pending', 'processing', 'partial', 'completed', 'failed'],
      }),
    );

    // Create distribution_batch_status enum
    await queryRunner.createEnum(
      new TableEnum({
        name: 'distribution_batch_status',
        values: ['initiated', 'in_progress', 'completed', 'partial_completion', 'failed'],
      }),
    );

    // Create audit_action enum
    await queryRunner.createEnum(
      new TableEnum({
        name: 'treasury_audit_action',
        values: [
          'distribution_initiated',
          'distribution_started',
          'distribution_completed',
          'distribution_failed',
          'partial_distribution',
          'refund_processed',
          'batch_completed',
          'batch_failed',
        ],
      }),
    );

    // Create treasury_distribution_batches table
    await queryRunner.createTable(
      new Table({
        name: 'treasury_distribution_batches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'batch_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'status',
            type: 'distribution_batch_status',
            default: "'initiated'",
          },
          {
            name: 'total_prize_amount',
            type: 'numeric',
            precision: 20,
            scale: 0,
          },
          {
            name: 'total_distributed_amount',
            type: 'numeric',
            precision: 20,
            scale: 0,
            default: 0,
          },
          {
            name: 'total_winners',
            type: 'int',
            default: 0,
          },
          {
            name: 'successful_distributions',
            type: 'int',
            default: 0,
          },
          {
            name: 'failed_distributions',
            type: 'int',
            default: 0,
          },
          {
            name: 'partial_distributions',
            type: 'int',
            default: 0,
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
    );

    // Create treasury_distributions table
    await queryRunner.createTable(
      new Table({
        name: 'treasury_distributions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'batch_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'distribution_status',
            default: "'pending'",
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'bet_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'prize_amount',
            type: 'numeric',
            precision: 20,
            scale: 0,
          },
          {
            name: 'distributed_amount',
            type: 'numeric',
            precision: 20,
            scale: 0,
            default: 0,
          },
          {
            name: 'pending_amount',
            type: 'numeric',
            precision: 20,
            scale: 0,
            default: 0,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'transaction_hash',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'distributed_at',
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
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            name: 'FK_TREASURY_DISTRIBUTION_BATCH',
            columnNames: ['batch_id'],
            referencedTableName: 'treasury_distribution_batches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_TREASURY_DISTRIBUTION_USER',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_TREASURY_DISTRIBUTION_BET',
            columnNames: ['bet_id'],
            referencedTableName: 'bets',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    // Create treasury_audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'treasury_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'distribution_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'batch_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'treasury_audit_action',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 20,
            scale: 0,
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'transaction_hash',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_TREASURY_AUDIT_DISTRIBUTION',
            columnNames: ['distribution_id'],
            referencedTableName: 'treasury_distributions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_TREASURY_AUDIT_BATCH',
            columnNames: ['batch_id'],
            referencedTableName: 'treasury_distribution_batches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create indexes for better performance
    await queryRunner.createIndex(
      'treasury_distributions',
      new TableIndex({
        name: 'IDX_TREASURY_DIST_BATCH',
        columnNames: ['batch_id'],
      }),
    );

    await queryRunner.createIndex(
      'treasury_distributions',
      new TableIndex({
        name: 'IDX_TREASURY_DIST_USER',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'treasury_distributions',
      new TableIndex({
        name: 'IDX_TREASURY_DIST_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'treasury_audit_logs',
      new TableIndex({
        name: 'IDX_TREASURY_AUDIT_BATCH',
        columnNames: ['batch_id'],
      }),
    );

    await queryRunner.createIndex(
      'treasury_audit_logs',
      new TableIndex({
        name: 'IDX_TREASURY_AUDIT_DISTRIBUTION',
        columnNames: ['distribution_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('treasury_audit_logs');
    await queryRunner.dropTable('treasury_distributions');
    await queryRunner.dropTable('treasury_distribution_batches');
    await queryRunner.dropEnum('treasury_audit_action');
    await queryRunner.dropEnum('distribution_batch_status');
    await queryRunner.dropEnum('distribution_status');
  }
}
