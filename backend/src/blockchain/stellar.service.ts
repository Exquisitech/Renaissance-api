import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  Account,
  StrKey,
  Asset,
} from '@stellar/stellar-sdk';

export interface WalletConnectionResponse {
  publicKey: string;
  network: string;
  connected: boolean;
  timestamp: Date;
}

export interface XlmBalanceResponse {
  address: string;
  balance: number;
  reserves: number;
  available: number;
  lastModified: Date;
}

export interface TransferXlmResponse {
  success: boolean;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  fee: number;
  timestamp: Date;
}

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: rpc.Server | null = null;
  private networkPassphrase: string = '';
  private rpcUrl: string = '';

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    this.rpcUrl = this.configService.get<string>('blockchain.stellar.rpcUrl') || '';
    this.networkPassphrase = this.configService.get<string>('blockchain.stellar.networkPassphrase') || '';

    if (!this.rpcUrl) {
      this.logger.warn('Stellar RPC URL not configured. Stellar services are disabled.');
      return;
    }

    this.server = new rpc.Server(this.rpcUrl);
    this.logger.log(`Stellar service initialized with RPC: ${this.rpcUrl}`);
  }

  /**
   * Get wallet connection information
   * Simulates Freighter wallet connection response
   * In production, this would integrate with @stellar/freighter-api
   */
  async connectWallet(publicKey: string): Promise<WalletConnectionResponse> {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new BadRequestException('Invalid Stellar public key format');
    }

    this.logger.log(`Wallet connection requested for: ${publicKey}`);

    return {
      publicKey,
      network: this.networkPassphrase || Networks.TESTNET,
      connected: true,
      timestamp: new Date(),
    };
  }

  /**
   * Get XLM balance for a given Stellar address
   * Queries the Stellar network to retrieve account balance
   */
  async getXlmBalance(address: string): Promise<XlmBalanceResponse> {
    this.assertConfigured();

    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new BadRequestException('Invalid Stellar address format');
    }

    try {
      this.logger.log(`Fetching XLM balance for: ${address}`);

      const account = await this.server!.getAccount(address);
      const balances = account.balances;

      // Find native XLM balance
      const xlmBalance = balances.find((b) => b.asset_type === 'native');

      if (!xlmBalance) {
        throw new BadRequestException('No XLM balance found for this account');
      }

      const balance = parseFloat(xlmBalance.balance);
      const reserves = this.calculateReserves(account);
      const available = balance - reserves;

      return {
        address,
        balance,
        reserves,
        available,
        lastModified: new Date(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error fetching XLM balance for ${address}: ${error.message}`);
      throw new ServiceUnavailableException('Unable to fetch balance from Stellar network');
    }
  }

  /**
   * Transfer XLM from one address to another
   * Requires the sender's secret key to sign the transaction
   */
  async transferXlm(
    fromSecretKey: string,
    toAddress: string,
    amount: number,
    memo?: string,
  ): Promise<TransferXlmResponse> {
    this.assertConfigured();

    // Validate inputs
    let fromKeypair: Keypair;
    try {
      fromKeypair = Keypair.fromSecret(fromSecretKey);
    } catch (error) {
      throw new BadRequestException('Invalid secret key format');
    }

    if (!StrKey.isValidEd25519PublicKey(toAddress)) {
      throw new BadRequestException('Invalid destination address format');
    }

    if (amount <= 0) {
      throw new BadRequestException('Transfer amount must be greater than 0');
    }

    const minimumBalance = 1.0; // XLM
    const fromBalance = await this.getXlmBalance(fromKeypair.publicKey());

    if (fromBalance.available < amount + minimumBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${fromBalance.available} XLM, Required: ${amount + minimumBalance} XLM (including minimum reserve)`,
      );
    }

    try {
      this.logger.log(
        `Transferring ${amount} XLM from ${fromKeypair.publicKey()} to ${toAddress}`,
      );

      // Load source account
      const sourceAccount = await this.server!.getAccount(fromKeypair.publicKey());

      // Build transaction
      const transaction = new TransactionBuilder(new Account(sourceAccount.id, sourceAccount.sequence), {
        fee: '100', // Base fee in stroops (0.00001 XLM)
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: toAddress,
            asset: Asset.native(),
            amount: amount.toString(),
          }),
        )
        .setTimeout(180) // 3 minutes timeout
        .build();

      // Sign transaction
      transaction.sign(fromKeypair);

      // Submit transaction
      const sendResponse = await this.server!.sendTransaction(transaction);

      this.logger.log(`Transaction submitted: ${sendResponse.hash}`);

      if (sendResponse.status === 'PENDING') {
        // Wait for transaction confirmation
        const txResponse = await this.waitForTransaction(sendResponse.hash);

        if (txResponse.status === 'SUCCESS') {
          return {
            success: true,
            transactionHash: sendResponse.hash,
            fromAddress: fromKeypair.publicKey(),
            toAddress,
            amount,
            fee: 0.00001,
            timestamp: new Date(),
          };
        } else {
          throw new Error(`Transaction failed with status: ${txResponse.status}`);
        }
      } else {
        throw new Error(`Transaction submission failed: ${sendResponse.status}`);
      }
    } catch (error) {
      this.logger.error(`Error transferring XLM: ${error.message}`);
      throw new BadRequestException(`XLM transfer failed: ${error.message}`);
    }
  }

  /**
   * Validate a Stellar address format
   */
  validateAddress(address: string): boolean {
    try {
      return StrKey.isValidEd25519PublicKey(address);
    } catch {
      return false;
    }
  }

  /**
   * Get network information
   */
  getNetworkInfo(): { network: string; rpcUrl: string; connected: boolean } {
    return {
      network: this.networkPassphrase || 'Not configured',
      rpcUrl: this.rpcUrl || 'Not configured',
      connected: this.server !== null,
    };
  }

  /**
   * Calculate account reserves based on subentries
   */
  private calculateReserves(account: any): number {
    const baseReserve = 0.5; // XLM
    const subentryCount = account.subentry_count || 0;
    const subentryReserve = subentryCount * 0.5; // 0.5 XLM per subentry
    return baseReserve + subentryReserve;
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransaction(
    txHash: string,
    maxAttempts: number = 20,
    pollIntervalMs: number = 1500,
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const transaction = await this.server!.getTransaction(txHash);

        if (transaction.status === 'SUCCESS') {
          return transaction;
        }

        if (transaction.status === 'FAILED') {
          throw new Error(`Transaction ${txHash} failed`);
        }

        // Wait before next poll
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(
            `Timed out waiting for transaction ${txHash} after ${maxAttempts} attempts`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    throw new Error(
      `Timed out waiting for transaction ${txHash} after ${maxAttempts} attempts`,
    );
  }

  /**
   * Assert that the service is properly configured
   */
  private assertConfigured(): void {
    if (!this.server || !this.rpcUrl) {
      throw new ServiceUnavailableException(
        'Stellar service is not configured. Please check RPC URL configuration.',
      );
    }
  }
}
