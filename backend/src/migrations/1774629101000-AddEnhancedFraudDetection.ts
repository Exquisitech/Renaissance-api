import { MigrationInterface, QueryRunner, TableEnum, TableColumn, TableIndex } from 'typeorm';

export class AddEnhancedFraudDetection1774629101000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add risk_level enum type
    await queryRunner.createEnumType(
      new TableEnum({
        name: 'risk_level_enum',
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      }),
    );

    // Add risk_level column to fraud_logs
    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'riskLevel',
        type: 'enum',
        enumName: 'risk_level_enum',
        default: "'MEDIUM'",
      }),
    );

    // Add new fraud reasons to the existing enum (if supported) or recreate
    // For PostgreSQL, we need to use raw SQL to add enum values
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'SAME_IP_MULTIPLE_ACCOUNTS';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'SAME_DEVICE_MULTIPLE_ACCOUNTS';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'COLLUSION_SUSPECTED';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'COORDINATED_BETTING';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'SUDDEN_LARGE_BET';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'ABNORMAL_BET_INCREASE';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'BETTING_PATTERN_ANOMALY';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'UNUSUAL_TIME_ACTIVITY';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'RAPID_SUCCESSION_BETS';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'SUSPICIOUS_TRANSACTION';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'STRUCTURING_DETECTED';
    `);
    await queryRunner.query(`
      ALTER TYPE fraud_reason_enum ADD VALUE IF NOT EXISTS 'MONEY_LAUNDERING_RED_FLAG';
    `);

    // Add UNDER_REVIEW to fraud_status_enum
    await queryRunner.query(`
      ALTER TYPE fraud_status_enum ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
    `);

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'fraud_logs',
      new TableIndex({
        name: 'IDX_fraud_reason',
        columnNames: ['reason'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_logs',
      new TableIndex({
        name: 'IDX_fraud_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_logs',
      new TableIndex({
        name: 'IDX_fraud_risk_level',
        columnNames: ['riskLevel'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_logs',
      new TableIndex({
        name: 'IDX_fraud_created_at',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('fraud_logs', 'IDX_fraud_created_at');
    await queryRunner.dropIndex('fraud_logs', 'IDX_fraud_risk_level');
    await queryRunner.dropIndex('fraud_logs', 'IDX_fraud_status');
    await queryRunner.dropIndex('fraud_logs', 'IDX_fraud_reason');

    // Drop risk_level column
    await queryRunner.dropColumn('fraud_logs', 'riskLevel');

    // Drop enum types (note: this will fail if the enums are in use)
    await queryRunner.dropEnumType('risk_level_enum');
  }
}
