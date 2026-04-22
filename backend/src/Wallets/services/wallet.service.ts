import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { GetTransactionsDto } from './dto/get-transactions.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
  ) {}

  async getTransactions(userId: string, query: GetTransactionsDto) {
    const { page = 1, limit = 10, cursor, type, startDate, endDate } = query;

    const qb = this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC');

    // ✅ Filter by type
    if (type) {
      qb.andWhere('tx.type = :type', { type });
    }

    // ✅ Date range filtering
    if (startDate && endDate) {
      qb.andWhere('tx.createdAt BETWEEN :start AND :end', {
        start: new Date(startDate),
        end: new Date(endDate),
      });
    }

    // ✅ Cursor-based pagination (better for large datasets)
    if (cursor) {
      qb.andWhere('tx.createdAt < :cursor', {
        cursor: new Date(cursor),
      });
    }

    // ✅ Offset pagination (fallback / UI support)
    const skip = (Number(page) - 1) * Number(limit);
    qb.skip(skip).take(Number(limit));

    const [transactions, total] = await qb.getManyAndCount();

    return {
      data: transactions,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        hasNext: transactions.length === Number(limit),
        nextCursor:
          transactions.length > 0
            ? transactions[transactions.length - 1].createdAt
            : null,
      },
    };
  }
}