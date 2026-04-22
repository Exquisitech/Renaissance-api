import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddFraudReviewFields1775100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add riskScore column for numeric 1-100 scoring
    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'riskScore',
        type: 'int',
        default: 50,
      }),
    );

    // Add admin review tracking columns
    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'reviewedBy',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'reviewedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'reviewNotes',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'resolvedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    // Add updatedAt column for entity tracking
    await queryRunner.addColumn(
      'fraud_logs',
      new TableColumn({
        name: 'updatedAt',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
      }),
    );

    // Index for faster admin queries by reviewer
    await queryRunner.createIndex(
      'fraud_logs',
      new TableIndex({
        name: 'IDX_fraud_reviewed_by',
        columnNames: ['reviewedBy'],
      }),
    );

    // Composite index for efficient open-case queries
    await queryRunner.createIndex(
      'fraud_logs',
      new TableIndex({
        name: 'IDX_fraud_user_status',
        columnNames: ['userId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('fraud_logs', 'IDX_fraud_user_status');
    await queryRunner.dropIndex('fraud_logs', 'IDX_fraud_reviewed_by');
    await queryRunner.dropColumn('fraud_logs', 'updatedAt');
    await queryRunner.dropColumn('fraud_logs', 'resolvedAt');
    await queryRunner.dropColumn('fraud_logs', 'reviewNotes');
    await queryRunner.dropColumn('fraud_logs', 'reviewedAt');
    await queryRunner.dropColumn('fraud_logs', 'reviewedBy');
    await queryRunner.dropColumn('fraud_logs', 'riskScore');
  }
}
