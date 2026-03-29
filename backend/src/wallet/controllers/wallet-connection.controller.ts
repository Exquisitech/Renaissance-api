import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletConnectionService } from '../services/wallet-connection.service';
import {
  RequestNonceDto,
  VerifySignatureDto,
  ConnectWalletDto,
  DisconnectWalletDto,
  WalletResponseDto,
  NonceResponseDto,
} from '../dto/wallet-connection.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Wallet Connection')
@Controller('wallet')
export class WalletConnectionController {
  private readonly logger = new Logger(WalletConnectionController.name);

  constructor(
    private readonly walletConnectionService: WalletConnectionService,
  ) {}

  @Post('request-nonce')
  @ApiOperation({ summary: 'Request nonce for wallet authentication' })
  @ApiResponse({ 
    status: 201, 
    description: 'Nonce generated successfully',
    type: NonceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid public key' })
  async requestNonce(@Body() requestNonceDto: RequestNonceDto): Promise<NonceResponseDto> {
    this.logger.log(`Nonce requested for public key: ${requestNonceDto.publicKey}`);
    
    const result = await this.walletConnectionService.generateNonce(
      requestNonceDto.publicKey,
      requestNonceDto.walletType,
    );

    return result;
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect wallet to user account' })
  @ApiResponse({ 
    status: 201, 
    description: 'Wallet connected successfully',
    type: WalletResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid signature or unauthorized' })
  @ApiResponse({ status: 409, description: 'Wallet already connected to another account' })
  async connectWallet(
    @Request() req,
    @Body() connectWalletDto: ConnectWalletDto,
  ): Promise<WalletResponseDto> {
    this.logger.log(`Wallet connection request for user ${req.user.sub}`);
    
    const walletConnection = await this.walletConnectionService.connectWallet(
      req.user.sub,
      connectWalletDto.publicKey,
      connectWalletDto.walletType,
      connectWalletDto.signature,
      connectWalletDto.message,
    );

    return {
      id: walletConnection.id,
      userId: walletConnection.userId,
      publicKey: walletConnection.publicKey,
      walletType: walletConnection.walletType,
      status: walletConnection.status,
      lastUsedAt: walletConnection.lastUsedAt,
      createdAt: walletConnection.createdAt,
    };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify wallet signature (standalone verification)' })
  @ApiResponse({ status: 200, description: 'Signature verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  @HttpCode(HttpStatus.OK)
  async verifySignature(@Body() verifySignatureDto: VerifySignatureDto): Promise<{ valid: boolean }> {
    const isValid = await this.walletConnectionService.verifySignature(
      verifySignatureDto.publicKey,
      verifySignatureDto.message,
      verifySignatureDto.signature,
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    return { valid: true };
  }

  @Get('my-wallets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all wallets connected to current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of connected wallets',
    type: [WalletResponseDto],
  })
  async getMyWallets(@Request() req): Promise<WalletResponseDto[]> {
    const wallets = await this.walletConnectionService.getUserWallets(req.user.sub);
    
    return wallets.map(wallet => ({
      id: wallet.id,
      userId: wallet.userId,
      publicKey: wallet.publicKey,
      walletType: wallet.walletType,
      status: wallet.status,
      lastUsedAt: wallet.lastUsedAt,
      createdAt: wallet.createdAt,
    }));
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect wallet from user account' })
  @ApiResponse({ status: 200, description: 'Wallet disconnected successfully' })
  @ApiResponse({ status: 404, description: 'Wallet connection not found' })
  @HttpCode(HttpStatus.OK)
  async disconnectWallet(
    @Request() req,
    @Body() disconnectWalletDto: DisconnectWalletDto,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Wallet disconnect request for user ${req.user.sub}`);
    
    await this.walletConnectionService.disconnectWallet(
      req.user.sub,
      disconnectWalletDto.publicKey,
    );

    return { success: true };
  }

  @Get('validate/:publicKey')
  @ApiOperation({ summary: 'Validate if wallet is connected and active' })
  @ApiResponse({ status: 200, description: 'Wallet validation result' })
  async validateWallet(@Request() req, publicKey: string): Promise<{ valid: boolean }> {
    const isValid = await this.walletConnectionService.validateWalletConnection(publicKey);
    return { valid: isValid };
  }
}
