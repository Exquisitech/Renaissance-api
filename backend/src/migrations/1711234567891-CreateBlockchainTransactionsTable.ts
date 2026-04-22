import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateBlockchainTransactionsTable1711234567891 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create blockchain_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'blockchain_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'public_key',
            type: 'varchar',
            length: '56',
            isNullable: true,
          },
          {
            name: 'hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'submitted', 'confirmed', 'failed', 'timeout'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'payment',
              'contract_call',
              'token_transfer',
              'bet_placement',
              'bet_settlement',
              'withdrawal',
              'deposit',
            ],
            isNullable: false,
          },
          {
            name: 'transaction_xdr',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'result_xdr',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'ledger',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'confirmations',
            type: 'bigint',
            default: 0,
            isNullable: false,
          },
          {
            name: 'required_confirmations',
            type: 'bigint',
            default: 1,
            isNullable: false,
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
            name: 'submitted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'confirmed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'blockchain_transactions',
      new TableIndex({
        name: 'IDX_BLOCKCHAIN_TX_HASH',
        columnNames: ['hash'],
      }),
    );

    await queryRunner.createIndex(
      'blockchain_transactions',
      new TableIndex({
        name: 'IDX_BLOCKCHAIN_TX_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'blockchain_transactions',
      new TableIndex({
        name: 'IDX_BLOCKCHAIN_TX_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'blockchain_transactions',
      new TableIndex({
        name: 'IDX_BLOCKCHAIN_TX_TYPE',
        columnNames: ['type'],
      }),
    );

    // Create foreign key to users table
    await queryRunner.createForeignKey(
      'blockchain_transactions',
      new TableForeignKey({
        name: 'FK_BLOCKCHAIN_TX_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const blockchainTxTable = await queryRunner.getTable('blockchain_transactions');
    const foreignKey = blockchainTxTable?.foreignKeys.find(
      (fk) => fk.name === 'FK_BLOCKCHAIN_TX_USER',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('blockchain_transactions', foreignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex('blockchain_transactions', 'IDX_BLOCKCHAIN_TX_HASH');
    await queryRunner.dropIndex('blockchain_transactions', 'IDX_BLOCKCHAIN_TX_USER_ID');
    await queryRunner.dropIndex('blockchain_transactions', 'IDX_BLOCKCHAIN_TX_STATUS');
    await queryRunner.dropIndex('blockchain_transactions', 'IDX_BLOCKCHAIN_TX_TYPE');

    // Drop table
    await queryRunner.dropTable('blockchain_transactions');
  }
}
