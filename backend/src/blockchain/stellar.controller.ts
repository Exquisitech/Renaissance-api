import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StellarService } from './stellar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Stellar Wallet')
@Controller('stellar')
export class StellarController {
  constructor(private readonly stellarService: StellarService) {}

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect wallet via Freighter' })
  @ApiResponse({ status: 200, description: 'Wallet connected successfully' })
  async connectWallet(
    @Body() body: { publicKey: string },
  ) {
    return this.stellarService.connectWallet(body.publicKey);
  }

  @Get('balance/:address')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'View XLM balance for an address' })
  @ApiResponse({ status: 200, description: 'XLM balance retrieved' })
  async getBalance(@Param('address') address: string) {
    return this.stellarService.getXlmBalance(address);
  }

  @Post('transfer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transfer XLM to another address' })
  @ApiResponse({ status: 200, description: 'XLM transferred successfully' })
  async transferXlm(
    @Body() body: {
      fromSecretKey: string;
      toAddress: string;
      amount: number;
      memo?: string;
    },
  ) {
    return this.stellarService.transferXlm(
      body.fromSecretKey,
      body.toAddress,
      body.amount,
      body.memo,
    );
  }

  @Get('network')
  @ApiOperation({ summary: 'Get Stellar network information' })
  @ApiResponse({ status: 200, description: 'Network information retrieved' })
  async getNetworkInfo() {
    return this.stellarService.getNetworkInfo();
  }

  @Get('validate/:address')
  @ApiOperation({ summary: 'Validate a Stellar address format' })
  @ApiResponse({ status: 200, description: 'Address validation result' })
  async validateAddress(@Param('address') address: string) {
    const isValid = this.stellarService.validateAddress(address);
    return { address, isValid };
  }
}
