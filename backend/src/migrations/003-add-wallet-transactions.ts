import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  Table,
  TableForeignKey,
} from 'typeorm';

export class AddWalletAndTransactions1700000000000 implements MigrationInterface {
  name = 'AddWalletAndTransactions1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add wallet_balance column to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'wallet_balance',
        type: 'decimal',
        precision: 18,
        scale: 8,
        default: 0,
        isNullable: false,
      }),
    );

    // Create transactions table
    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'bet_placement',
              'bet_winning',
              'bet_cancellation',
              'wallet_deposit',
              'wallet_withdrawal',
              'staking_reward',
              'staking_penalty',
            ],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed', 'reversed'],
            default: `'pending'`,
          },
          {
            name: 'reference_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'related_entity_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
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

    // Add foreign key for user_id in transactions table
    await queryRunner.createForeignKey(
      'transactions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_transactions_user_id',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_TRANSACTIONS_USER_ID ON transactions(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_TRANSACTIONS_TYPE ON transactions(type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_TRANSACTIONS_STATUS ON transactions(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_TRANSACTIONS_CREATED_AT ON transactions(created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_TRANSACTIONS_CREATED_AT`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_TRANSACTIONS_STATUS`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_TRANSACTIONS_TYPE`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_TRANSACTIONS_USER_ID`);

    // Drop foreign key
    await queryRunner.dropForeignKey('transactions', 'FK_transactions_user_id');

    // Drop transactions table
    await queryRunner.dropTable('transactions');

    // Drop wallet_balance column
    await queryRunner.dropColumn('users', 'wallet_balance');
  }
}
