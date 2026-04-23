import { Injectable, Logger, Optional } from '@nestjs/common';

export interface WalletService {
  getBalance(userId: string): Promise<number>;
  getAddress(userId: string): Promise<string | null>;
}

@Injectable()
export class LiveWalletAdapter {
  private readonly logger = new Logger(LiveWalletAdapter.name);

  constructor(@Optional() private readonly walletService: WalletService | null) {}

  async getBalance(userId: string): Promise<number | null> {
    if (!this.walletService) {
      this.logger.debug(`Wallet service unavailable, skipping balance for user ${userId}`);
      return null;
    }
    return this.walletService.getBalance(userId);
  }

  async getAddress(userId: string): Promise<string | null> {
    if (!this.walletService) {
      return null;
    }
    return this.walletService.getAddress(userId);
  }

  isAvailable(): boolean {
    return this.walletService !== null;
  }
}
