import { MigrationInterface, QueryRunner, Table, TableEnum } from 'typeorm';

export class CreateSolvencyProofTables1711641600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createEnum(
      new TableEnum({
        name: 'proof_status',
        values: ['generated', 'published', 'failed'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'solvency_proofs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'proof_number',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'proof_timestamp',
            type: 'timestamp',
          },
          {
            name: 'merkle_root',
            type: 'text',
          },
          {
            name: 'total_liabilities',
            type: 'numeric',
            precision: 20,
            scale: 0,
          },
          {
            name: 'total_reserves',
            type: 'numeric',
            precision: 20,
            scale: 0,
          },
          {
            name: 'solvency_ratio',
            type: 'numeric',
            precision: 10,
            scale: 6,
          },
          {
            name: 'status',
            type: 'proof_status',
            default: "'generated'",
          },
          {
            name: 'transaction_hash',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'block_number',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'published_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_balance_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'balance',
            type: 'numeric',
            precision: 20,
            scale: 0,
          },
          {
            name: 'balance_hash',
            type: 'text',
          },
          {
            name: 'proof_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'snapshot_timestamp',
            type: 'timestamp',
          },
          {
            name: 'leaf_index',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'merkle_proof',
            type: 'jsonb',
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
            name: 'FK_SNAPSHOT_PROOF',
            columnNames: ['proof_id'],
            referencedTableName: 'solvency_proofs',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'user_balance_snapshots',
      new TableIndex({
        name: 'IDX_SNAPSHOT_TIMESTAMP',
        columnNames: ['snapshot_timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'user_balance_snapshots',
      new TableIndex({
        name: 'IDX_SNAPSHOT_PROOF',
        columnNames: ['proof_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_balance_snapshots');
    await queryRunner.dropTable('solvency_proofs');
    await queryRunner.dropEnum('proof_status');
  }
}
