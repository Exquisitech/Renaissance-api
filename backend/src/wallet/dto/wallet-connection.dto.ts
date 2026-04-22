import { IsString, IsEnum, IsOptional, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WalletType } from '../entities/wallet-connection.entity';

export class RequestNonceDto {
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @ApiProperty({
    description: 'Wallet type (freighter, albedo, etc.)',
    enum: WalletType,
    default: WalletType.FREIGHTER,
    required: false,
  })
  @IsEnum(WalletType)
  @IsOptional()
  walletType?: WalletType;
}

export class VerifySignatureDto {
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @ApiProperty({
    description: 'Base64 encoded signature',
    example: 'AAAAAAAAAAAA...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Original message that was signed',
    example: 'Login to Renaissance Platform\nNonce: abc123\nTimestamp: 1234567890',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ConnectWalletDto {
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @ApiProperty({
    description: 'Wallet type (freighter, albedo, etc.)',
    enum: WalletType,
    default: WalletType.FREIGHTER,
  })
  @IsEnum(WalletType)
  @IsNotEmpty()
  walletType: WalletType;

  @ApiProperty({
    description: 'Base64 encoded signature',
    example: 'AAAAAAAAAAAA...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Original message that was signed',
    example: 'Login to Renaissance Platform\nNonce: abc123\nTimestamp: 1234567890',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class DisconnectWalletDto {
  @ApiProperty({
    description: 'Wallet public key to disconnect',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}

export class WalletResponseDto {
  @ApiProperty({ description: 'Wallet connection ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Public key' })
  publicKey: string;

  @ApiProperty({ description: 'Wallet type', enum: WalletType })
  walletType: WalletType;

  @ApiProperty({ description: 'Wallet status', enum: ['active', 'inactive', 'disconnected'] })
  status: string;

  @ApiProperty({ description: 'Last used timestamp', required: false })
  lastUsedAt?: Date;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}

export class NonceResponseDto {
  @ApiProperty({ description: 'Generated nonce' })
  nonce: string;

  @ApiProperty({ description: 'Message to sign' })
  message: string;

  @ApiProperty({ description: 'Nonce expiration timestamp' })
  expiresAt: Date;
}
