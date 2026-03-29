import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateWalletConnectionsTable1711234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create wallet_connections table
    await queryRunner.createTable(
      new Table({
        name: 'wallet_connections',
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
            isNullable: false,
          },
          {
            name: 'wallet_type',
            type: 'enum',
            enum: ['freighter', 'albedo', 'stellarx', 'ledger', 'other'],
            default: "'freighter'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'disconnected'],
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'last_used_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'nonce',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'nonce_expires_at',
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
      'wallet_connections',
      new TableIndex({
        name: 'IDX_WALLET_CONNECTIONS_PUBLIC_KEY',
        columnNames: ['public_key'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_connections',
      new TableIndex({
        name: 'IDX_WALLET_CONNECTIONS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_connections',
      new TableIndex({
        name: 'IDX_WALLET_CONNECTIONS_STATUS',
        columnNames: ['status'],
      }),
    );

    // Create foreign key to users table
    await queryRunner.createForeignKey(
      'wallet_connections',
      new TableForeignKey({
        name: 'FK_WALLET_CONNECTIONS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const walletConnectionsTable = await queryRunner.getTable('wallet_connections');
    const foreignKey = walletConnectionsTable?.foreignKeys.find(
      (fk) => fk.name === 'FK_WALLET_CONNECTIONS_USER',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('wallet_connections', foreignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex('wallet_connections', 'IDX_WALLET_CONNECTIONS_PUBLIC_KEY');
    await queryRunner.dropIndex('wallet_connections', 'IDX_WALLET_CONNECTIONS_USER_ID');
    await queryRunner.dropIndex('wallet_connections', 'IDX_WALLET_CONNECTIONS_STATUS');

    // Drop table
    await queryRunner.dropTable('wallet_connections');
  }
}
