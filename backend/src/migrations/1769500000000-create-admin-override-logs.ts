import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateAdminOverrideLogs1769500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_override_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'admin_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'action_type',
            type: 'enum',
            enum: [
              'balance_adjustment',
              'bet_outcome_correction',
              'free_bet_voucher_issued',
              'spin_reward_reversal',
              'settlement_reversal',
            ],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'executed', 'rejected', 'reversed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'affected_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'affected_entity_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'affected_entity_type',
            type: 'varchar',
            isNullable: true,
            comment: 'Type of affected entity: bet, spin, user, voucher, etc.',
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'previous_values',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'new_values',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'executed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'executed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'requires_onchain_approval',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment:
              'Indicates if this override requires special on-chain settlement approval',
          },
          {
            name: 'onchain_approved',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: 'Whether on-chain settlement override has been approved',
          },
          {
            name: 'onchain_approval_admin_id',
            type: 'uuid',
            isNullable: true,
            comment: 'Admin who approved the on-chain override',
          },
          {
            name: 'reversal_reason',
            type: 'text',
            isNullable: true,
            comment: 'Reason for reversing the override',
          },
          {
            name: 'reversed_by',
            type: 'uuid',
            isNullable: true,
            comment: 'Admin who reversed the override',
          },
          {
            name: 'reversed_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'When the override was reversed',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndices('admin_override_logs', [
      new TableIndex({
        name: 'IDX_admin_override_admin_id',
        columnNames: ['admin_id'],
      }),
      new TableIndex({
        name: 'IDX_admin_override_action_type',
        columnNames: ['action_type'],
      }),
      new TableIndex({
        name: 'IDX_admin_override_created_at',
        columnNames: ['created_at'],
      }),
      new TableIndex({
        name: 'IDX_admin_override_affected_user_id',
        columnNames: ['affected_user_id'],
      }),
      new TableIndex({
        name: 'IDX_admin_override_status',
        columnNames: ['status'],
      }),
      new TableIndex({
        name: 'IDX_admin_override_admin_created',
        columnNames: ['admin_id', 'created_at'],
      }),
      new TableIndex({
        name: 'IDX_admin_override_action_status',
        columnNames: ['action_type', 'status'],
      }),
    ]);

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'admin_override_logs',
      new TableForeignKey({
        columnNames: ['admin_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'admin_override_logs',
      new TableForeignKey({
        columnNames: ['affected_user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'admin_override_logs',
      new TableForeignKey({
        columnNames: ['onchain_approval_admin_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'admin_override_logs',
      new TableForeignKey({
        columnNames: ['reversed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    const table = await queryRunner.getTable('admin_override_logs');
    if (table) {
      const foreignKeys = table.foreignKeys.filter(
        (fk) =>
          fk.columnNames.includes('admin_id') ||
          fk.columnNames.includes('affected_user_id') ||
          fk.columnNames.includes('onchain_approval_admin_id') ||
          fk.columnNames.includes('reversed_by'),
      );

      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('admin_override_logs', fk);
      }
    }

    // Drop table
    await queryRunner.dropTable('admin_override_logs');
  }
}
