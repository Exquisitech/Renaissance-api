import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddLedgerConsistencyFields1769500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns for ledger consistency
    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'ledger_mismatch_count',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'onchain_discrepancy_count',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'offchain_discrepancy_count',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'rounding_difference_count',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'tolerance_threshold',
        type: 'decimal',
        precision: 10,
        scale: 8,
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'total_users_checked',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'users_with_discrepancies',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'users_within_tolerance',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'total_discrepancy_amount',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'average_discrepancy',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'max_discrepancy',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'min_discrepancy',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'ledger_consistency_data',
        type: 'json',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'reconciliation_reports',
      new TableColumn({
        name: 'balance_discrepancies',
        type: 'json',
        isNullable: true,
      }),
    );

    // Add indexes for new columns
    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_RECONCILIATION_REPORT_TYPE',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_RECONCILIATION_REPORT_TOLERANCE',
        columnNames: ['tolerance_threshold'],
      }),
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_RECONCILIATION_REPORT_USERS_CHECKED',
        columnNames: ['total_users_checked'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_RECONCILIATION_REPORT_TYPE',
    );
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_RECONCILIATION_REPORT_TOLERANCE',
    );
    await queryRunner.dropIndex(
      'reconciliation_reports',
      'IDX_RECONCILIATION_REPORT_USERS_CHECKED',
    );

    // Drop columns
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'ledger_mismatch_count',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'onchain_discrepancy_count',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'offchain_discrepancy_count',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'rounding_difference_count',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'tolerance_threshold',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'total_users_checked',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'users_with_discrepancies',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'users_within_tolerance',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'total_discrepancy_amount',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'average_discrepancy',
    );
    await queryRunner.dropColumn('reconciliation_reports', 'max_discrepancy');
    await queryRunner.dropColumn('reconciliation_reports', 'min_discrepancy');
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'ledger_consistency_data',
    );
    await queryRunner.dropColumn(
      'reconciliation_reports',
      'balance_discrepancies',
    );
  }
}
