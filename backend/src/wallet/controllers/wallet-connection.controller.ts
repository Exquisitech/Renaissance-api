import {
  Controller,
  Post,
  Delete,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { WalletConnectionService } from '../services/wallet-connection.service';
import { WalletType } from '../entities/wallet-connection.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

export class ConnectWalletDto {
  @ApiProperty({
    description: 'Stellar public key for the wallet',
    example: 'GA2U5FAMP2W6XL5E4QK5TBC4GZ4I4E5T7X8Y9Z0AB1C2D3E4F5G6H7I8J9K',
  })
  publicKey: string;

  @ApiProperty({
    description: 'Type of wallet being connected',
    enum: WalletType,
    required: false,
    example: WalletType.FREIGHTER,
  })
  walletType?: WalletType;
}

@ApiTags('Wallets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('wallet/connections')
export class WalletConnectionController {
  constructor(private readonly walletConnectionService: WalletConnectionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Connect a Stellar wallet address',
    description:
      'Links a Stellar wallet (Freighter, XBull, LOBSTR, etc.) to the authenticated user account. Each user can have multiple wallets but only one default.',
  })
  @ApiBody({ type: ConnectWalletDto })
  @ApiResponse({
    status: 201,
    description: 'Wallet successfully connected',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e12b-34d5-a678-901234567890',
        publicKey: 'GA2U5FAMP2W6XL5E4QK5TBC4GZ4I4E5T7X8Y9Z0AB1C2D3E4F5G6H7I8J9K',
        walletType: 'freighter',
        status: 'active',
        isDefault: true,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid wallet type or public key',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid wallet type',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 409,
    description: 'Wallet already connected to this account',
    schema: {
      example: {
        statusCode: 409,
        message: 'Wallet already connected',
        error: 'Conflict',
      },
    },
  })
  connect(@Req() req: any, @Body() dto: ConnectWalletDto) {
    return this.walletConnectionService.connectWallet(
      req.user.userId ?? req.user.id,
      dto.publicKey,
      dto.walletType,
    );
  }

  @Delete(':walletId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disconnect a wallet',
    description:
      'Removes a wallet connection from the user account. Cannot disconnect the default wallet if it is the only one.',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet connection UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet successfully disconnected',
    schema: {
      example: {
        success: true,
        message: 'Wallet disconnected successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot disconnect the only wallet or default wallet',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  disconnect(@Req() req: any, @Param('walletId') walletId: string) {
    return this.walletConnectionService.disconnectWallet(
      req.user.userId ?? req.user.id,
      walletId,
    );
  }

  @Patch(':walletId/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a wallet as default',
    description:
      'Sets the specified wallet as the default for transactions. Only one wallet can be default at a time.',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Wallet connection UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Default wallet updated successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        isDefault: true,
        message: 'Default wallet set successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot set disconnected wallet as default',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  setDefault(@Req() req: any, @Param('walletId') walletId: string) {
    return this.walletConnectionService.setDefaultWallet(
      req.user.userId ?? req.user.id,
      walletId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List all connected wallets',
    description: 'Retrieves all wallet connections for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallets retrieved successfully',
    schema: {
      example: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          publicKey: 'GA2U5FAMP2W6XL5E4QK5TBC4GZ4I4E5T7X8Y9Z0AB1C2D3E4F5G6H7I8J9K',
          walletType: 'freighter',
          status: 'active',
          isDefault: true,
          createdAt: '2024-01-15T10:30:00Z',
        },
        {
          id: '234e5678-e90b-12d3-a456-426614174001',
          publicKey: 'GA3V6GBNQ3X7YM6F5RL5UDCH5AH6JF8YK0Z1BC2E3F4G5H6I7J8K9L0M1N',
          walletType: 'xbull',
          status: 'active',
          isDefault: false,
          createdAt: '2024-01-16T14:20:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  list(@Req() req: any) {
    return this.walletConnectionService.getUserWallets(
      req.user.userId ?? req.user.id,
    );
  }

  @Get('default')
  @ApiOperation({
    summary: 'Get default wallet',
    description: 'Retrieves the default wallet for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Default wallet retrieved successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        publicKey: 'GA2U5FAMP2W6XL5E4QK5TBC4GZ4I4E5T7X8Y9Z0AB1C2D3E4F5G6H7I8J9K',
        walletType: 'freighter',
        status: 'active',
        isDefault: true,
        createdAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No default wallet set',
    schema: {
      example: {
        statusCode: 404,
        message: 'No default wallet found',
        error: 'Not Found',
      },
    },
  })
  getDefault(@Req() req: any) {
    return this.walletConnectionService.getDefaultWallet(
      req.user.userId ?? req.user.id,
    );
  }
}
