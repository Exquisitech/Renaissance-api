import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  BlockchainTransaction,
  TransactionStatus,
  TransactionType,
} from './entities/blockchain-transaction.entity';
import { SorobanRpc, Transaction as StellarTransaction, xdr } from '@stellar/stellar-sdk';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class TransactionProcessorService {
  private readonly logger = new Logger(TransactionProcessorService.name);
  private readonly CONFIRMATION_POLL_INTERVAL_MS = 2000; // 2 seconds
  private readonly CONFIRMATION_TIMEOUT_MS = 60000; // 60 seconds

  constructor(
    @InjectRepository(BlockchainTransaction)
    private readonly transactionRepository: Repository<BlockchainTransaction>,
    private readonly dataSource: DataSource,
    private readonly stellarService: StellarService,
  ) {}

  /**
   * Submit a transaction to the Stellar blockchain
   */
  async submitTransaction(
    transactionXdr: string,
    type: TransactionType,
    userId?: string | null,
    publicKey?: string | null,
    metadata?: Record<string, any>,
    requiredConfirmations: number = 1,
  ): Promise<BlockchainTransaction> {
    try {
      // Parse transaction XDR to get hash
      const tx = this.parseTransactionFromXdr(transactionXdr);
      const hash = tx.hash().toString('hex');

      // Check if transaction already exists
      const existingTx = await this.transactionRepository.findOne({
        where: { hash },
      });

      if (existingTx) {
        this.logger.warn(`Transaction already exists: ${hash}`);
        return existingTx;
      }

      // Create transaction record
      const blockchainTx = this.transactionRepository.create({
        userId,
        publicKey,
        hash,
        status: TransactionStatus.PENDING,
        type,
        transactionXDR: transactionXdr,
        requiredConfirmations,
        metadata,
      });

      const savedTx = await this.transactionRepository.save(blockchainTx);
      this.logger.log(`Transaction created: ${hash} for user ${userId || 'anonymous'}`);

      // Submit to Stellar network
      this.submitToNetwork(savedTx).catch((error) => {
        this.logger.error(`Failed to submit transaction ${hash}: ${error.message}`);
        this.updateTransactionStatus(hash, TransactionStatus.FAILED, error.message);
      });

      return savedTx;
    } catch (error) {
      this.logger.error(`Transaction submission failed: ${error.message}`, error);
      throw new BadRequestException(`Transaction submission failed: ${error.message}`);
    }
  }

  /**
   * Get transaction status by hash or ID
   */
  async getTransactionStatus(identifier: string): Promise<BlockchainTransaction | null> {
    const transaction = await this.transactionRepository.findOne({
      where: [{ id: identifier }, { hash: identifier }],
      relations: ['user'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Update confirmation count if submitted
    if (transaction.status === TransactionStatus.SUBMITTED) {
      await this.updateConfirmationCount(transaction);
    }

    return transaction;
  }

  /**
   * Get all transactions for a user
   */
  async getUserTransactions(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ data: BlockchainTransaction[]; total: number }> {
    const [data, total] = await this.transactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  /**
   * Generate transaction receipt
   */
  async generateReceipt(transactionId: string): Promise<any> {
    const transaction = await this.getTransactionStatus(transactionId);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      transactionId: transaction.id,
      hash: transaction.hash,
      status: transaction.status,
      type: transaction.type,
      ledger: transaction.ledger,
      confirmations: transaction.confirmations,
      resultXdr: transaction.resultXDR,
      metadata: transaction.metadata,
      timestamp: transaction.confirmedAt || transaction.createdAt,
    };
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    hash: string,
    status: TransactionStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.transactionRepository.update(
      { hash },
      {
        status,
        errorMessage,
        confirmedAt: status === TransactionStatus.CONFIRMED ? new Date() : undefined,
        submittedAt: status === TransactionStatus.SUBMITTED ? new Date() : undefined,
      },
    );
  }

  /**
   * Private helper: Submit transaction to Stellar network
   */
  private async submitToNetwork(tx: BlockchainTransaction): Promise<void> {
    try {
      const stellarTx = this.parseTransactionFromXdr(tx.transactionXDR);
      
      // Submit transaction via StellarService
      const sendResponse = await this.stellarService.sendTransaction(stellarTx);

      if (sendResponse.status === 'PENDING') {
        await this.updateTransactionStatus(tx.hash, TransactionStatus.SUBMITTED);
        
        // Wait for confirmations
        await this.waitForConfirmations(tx.hash, tx.requiredConfirmations);
      } else if (sendResponse.status === 'ERROR') {
        throw new Error(sendResponse.errorResult?.result().toXDR('base64') || 'Unknown error');
      }
    } catch (error) {
      this.logger.error(`Transaction submission to network failed: ${error.message}`);
      await this.updateTransactionStatus(tx.hash, TransactionStatus.FAILED, error.message);
      throw error;
    }
  }

  /**
   * Private helper: Wait for transaction confirmations
   */
  private async waitForConfirmations(
    hash: string,
    requiredConfirmations: number,
  ): Promise<void> {
    const deadline = Date.now() + this.CONFIRMATION_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const txResponse = await this.stellarService.getTransaction(hash);

        if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          const currentConfirmations = await this.getConfirmationCount(hash);

          await this.transactionRepository.update(
            { hash },
            {
              status: TransactionStatus.CONFIRMED,
              confirmations: currentConfirmations,
              ledger: txResponse.ledger,
              resultXDR: txResponse.returnValue?.toXDR('base64'),
              confirmedAt: new Date(),
            },
          );

          this.logger.log(`Transaction confirmed: ${hash} with ${currentConfirmations} confirmations`);
          return;
        }

        if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
          await this.updateTransactionStatus(
            hash,
            TransactionStatus.FAILED,
            'Transaction failed on network',
          );
          return;
        }

        // Still pending, wait and retry
        await this.sleep(this.CONFIRMATION_POLL_INTERVAL_MS);
      } catch (error) {
        this.logger.warn(`Error checking transaction status: ${error.message}`);
        await this.sleep(this.CONFIRMATION_POLL_INTERVAL_MS);
      }
    }

    // Timeout
    await this.updateTransactionStatus(
      hash,
      TransactionStatus.TIMEOUT,
      'Transaction confirmation timeout',
    );
  }

  /**
   * Private helper: Update confirmation count
   */
  private async updateConfirmationCount(tx: BlockchainTransaction): Promise<void> {
    try {
      const confirmations = await this.getConfirmationCount(tx.hash);
      if (confirmations > tx.confirmations) {
        await this.transactionRepository.update(
          { hash: tx.hash },
          { confirmations },
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to update confirmations for ${tx.hash}: ${error.message}`);
    }
  }

  /**
   * Private helper: Get confirmation count from network
   */
  private async getConfirmationCount(hash: string): Promise<number> {
    try {
      const txResponse = await this.stellarService.getTransaction(hash);
      
      if (txResponse.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return 0;
      }

      const latestLedger = await this.stellarService.getLatestLedger();
      const txLedger = txResponse.ledger;
      
      // Confirmations = current ledger - transaction ledger
      return Math.max(0, latestLedger - txLedger + 1);
    } catch {
      return 0;
    }
  }

  /**
   * Private helper: Parse transaction from XDR
   */
  private parseTransactionFromXdr(xdrString: string): StellarTransaction {
    try {
      return StellarTransaction.fromXDR(xdrString);
    } catch (error) {
      throw new BadRequestException(`Invalid transaction XDR: ${error.message}`);
    }
  }

  /**
   * Private helper: Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
