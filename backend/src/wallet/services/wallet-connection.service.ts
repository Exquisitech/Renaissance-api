import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WalletConnection, WalletStatus, WalletType } from './entities/wallet-connection.entity';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';

@Injectable()
export class WalletConnectionService {
  private readonly logger = new Logger(WalletConnectionService.name);
  private readonly NONCE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(WalletConnection)
    private readonly walletConnectionRepository: Repository<WalletConnection>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate a nonce for wallet authentication
   */
  async generateNonce(publicKey: string, walletType: WalletType = WalletType.FREIGHTER): Promise<{
    nonce: string;
    message: string;
    expiresAt: Date;
  }> {
    if (!this.isValidStellarPublicKey(publicKey)) {
      throw new BadRequestException('Invalid Stellar public key');
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.NONCE_EXPIRATION_MS);
    
    // Create message to sign
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `Login to Renaissance Platform\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

    // Update or create wallet connection with nonce
    await this.updateWalletNonce(publicKey, nonce, expiresAt, walletType);

    return {
      nonce,
      message,
      expiresAt,
    };
  }

  /**
   * Verify signature and authenticate wallet
   */
  async verifySignature(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    try {
      // Verify the signature using Stellar SDK
      const keypair = Keypair.fromPublicKey(publicKey);
      const messageBuffer = Buffer.from(message);
      const signatureBuffer = Buffer.from(signature, 'base64');

      const isValid = keypair.verify(messageBuffer, signatureBuffer);
      
      if (!isValid) {
        this.logger.warn(`Invalid signature for public key: ${publicKey}`);
        return false;
      }

      // Verify nonce exists and hasn't expired
      const walletConnection = await this.walletConnectionRepository.findOne({
        where: { publicKey },
      });

      if (!walletConnection || !walletConnection.nonce) {
        this.logger.warn(`No nonce found for public key: ${publicKey}`);
        return false;
      }

      // Check if nonce has expired
      if (walletConnection.nonceExpiresAt && walletConnection.nonceExpiresAt < new Date()) {
        this.logger.warn(`Expired nonce for public key: ${publicKey}`);
        return false;
      }

      // Verify message contains the correct nonce
      if (!message.includes(walletConnection.nonce)) {
        this.logger.warn(`Message nonce mismatch for public key: ${publicKey}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Connect wallet to user account
   */
  async connectWallet(
    userId: string,
    publicKey: string,
    walletType: WalletType,
    signature: string,
    message: string,
  ): Promise<WalletConnection> {
    // Verify signature first
    const isValid = await this.verifySignature(publicKey, message, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Check if wallet is already connected to another user
    const existingWallet = await this.walletConnectionRepository.findOne({
      where: { publicKey, status: WalletStatus.ACTIVE },
    });

    if (existingWallet && existingWallet.userId !== userId) {
      throw new ConflictException('Wallet already connected to another account');
    }

    // If wallet exists for this user, reactivate it
    if (existingWallet && existingWallet.userId === userId) {
      existingWallet.status = WalletStatus.ACTIVE;
      existingWallet.lastUsedAt = new Date();
      existingWallet.walletType = walletType;
      return await this.walletConnectionRepository.save(existingWallet);
    }

    // Create new wallet connection
    const walletConnection = this.walletConnectionRepository.create({
      userId,
      publicKey,
      walletType,
      status: WalletStatus.ACTIVE,
      lastUsedAt: new Date(),
    });

    return await this.walletConnectionRepository.save(walletConnection);
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(userId: string, publicKey: string): Promise<void> {
    const walletConnection = await this.walletConnectionRepository.findOne({
      where: { userId, publicKey },
    });

    if (!walletConnection) {
      throw new NotFoundException('Wallet connection not found');
    }

    walletConnection.status = WalletStatus.DISCONNECTED;
    await this.walletConnectionRepository.save(walletConnection);
  }

  /**
   * Get all wallets for a user
   */
  async getUserWallets(userId: string): Promise<WalletConnection[]> {
    return await this.walletConnectionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get active wallet by public key
   */
  async getWalletByPublicKey(publicKey: string): Promise<WalletConnection | null> {
    return await this.walletConnectionRepository.findOne({
      where: { publicKey, status: WalletStatus.ACTIVE },
    });
  }

  /**
   * Validate if wallet is connected and active
   */
  async validateWalletConnection(publicKey: string): Promise<boolean> {
    const wallet = await this.getWalletByPublicKey(publicKey);
    return wallet !== null;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(publicKey: string): Promise<void> {
    await this.walletConnectionRepository.update(
      { publicKey },
      { lastUsedAt: new Date() },
    );
  }

  /**
   * Clear expired nonce
   */
  async clearExpiredNonce(publicKey: string): Promise<void> {
    await this.walletConnectionRepository.update(
      { publicKey },
      { 
        nonce: null,
        nonceExpiresAt: null,
      },
    );
  }

  /**
   * Private helper: Update wallet nonce
   */
  private async updateWalletNonce(
    publicKey: string,
    nonce: string,
    expiresAt: Date,
    walletType: WalletType,
  ): Promise<void> {
    const existingWallet = await this.walletConnectionRepository.findOne({
      where: { publicKey },
    });

    if (existingWallet) {
      existingWallet.nonce = nonce;
      existingWallet.nonceExpiresAt = expiresAt;
      existingWallet.walletType = walletType;
      await this.walletConnectionRepository.save(existingWallet);
    } else {
      // Create temporary wallet connection entry (not linked to user yet)
      const tempWallet = this.walletConnectionRepository.create({
        userId: null, // Will be set after successful verification
        publicKey,
        walletType,
        nonce,
        nonceExpiresAt: expiresAt,
        status: WalletStatus.INACTIVE,
      });
      await this.walletConnectionRepository.save(tempWallet);
    }
  }

  /**
   * Private helper: Validate Stellar public key format
   */
  private isValidStellarPublicKey(publicKey: string): boolean {
    try {
      // Stellar public keys start with 'G' and are 56 characters long
      if (!publicKey.startsWith('G') || publicKey.length !== 56) {
        return false;
      }
      
      // Try to create a keypair - will throw if invalid
      Keypair.fromPublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }
}
