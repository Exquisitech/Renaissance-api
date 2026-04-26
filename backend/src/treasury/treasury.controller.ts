import { Controller, Post, Get, Param, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TreasuryService, DistributionRecipient } from './treasury.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

export class CreateDistributionDto {
  @ApiProperty({
    description: 'List of recipients for the distribution',
    type: [Object],
    example: [
      { userId: '456e7890-e12b-34d5-a678-901234567890', amount: 100.5 },
      { userId: '567e8901-e23c-45e6-b789-012345678901', amount: 250.0 },
    ],
  })
  recipients: DistributionRecipient[];
}

@ApiTags('Treasury')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Post('distributions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new treasury distribution',
    description:
      'Creates a distribution batch to allocate funds from treasury to multiple recipients. Requires admin privileges.',
  })
  @ApiBody({ type: CreateDistributionDto })
  @ApiResponse({
    status: 201,
    description: 'Distribution created successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        totalAmount: 350.5,
        status: 'pending',
        recipients: [
          { userId: '456e7890-e12b-34d5-a678-901234567890', amount: 100.5 },
          { userId: '567e8901-e23c-45e6-b789-012345678901', amount: 250.0 },
        ],
        createdAt: '2024-01-15T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid recipient data or insufficient treasury balance',
    schema: {
      example: {
        statusCode: 400,
        message: 'Insufficient treasury balance for distribution',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  create(@Req() req: Request, @Body() body: { recipients: DistributionRecipient[] }) {
    return this.treasuryService.createDistribution(body.recipients);
  }

  @Post('distributions/:id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a pending distribution',
    description:
      'Executes a pending treasury distribution, transferring funds to recipients. Requires admin privileges.',
  })
  @ApiParam({
    name: 'id',
    description: 'Distribution batch ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Distribution processed successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
        processedAt: '2024-01-15T11:00:00Z',
        txHash: 'GA2U...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - distribution already processed or invalid state',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'Distribution not found',
  })
  process(@Param('id') id: string) {
    return this.treasuryService.processDistribution(id);
  }

  @Get('distributions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all treasury distributions',
    description:
      'Retrieves a paginated list of all treasury distributions with optional filtering by status',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'processing', 'completed', 'failed'],
    description: 'Filter by distribution status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Distributions retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            totalAmount: 350.5,
            status: 'completed',
            recipientCount: 2,
            createdAt: '2024-01-15T10:30:00Z',
            processedAt: '2024-01-15T11:00:00Z',
          },
        ],
        total: 150,
        page: 1,
        limit: 20,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  list() {
    return this.treasuryService.listDistributions();
  }

  @Get('distributions/:id')
  @ApiOperation({
    summary: 'Get distribution by ID',
    description: 'Retrieves detailed information about a specific distribution batch',
  })
  @ApiParam({
    name: 'id',
    description: 'Distribution batch ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Distribution found',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        totalAmount: 350.5,
        status: 'completed',
        recipients: [
          { userId: '456e7890-e12b-34d5-a678-901234567890', amount: 100.5, txHash: 'GA2U...' },
          { userId: '567e8901-e23c-45e6-b789-012345678901', amount: 250.0, txHash: 'GA3V...' },
        ],
        createdAt: '2024-01-15T10:30:00Z',
        processedAt: '2024-01-15T11:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  @ApiResponse({
    status: 404,
    description: 'Distribution not found',
  })
  findOne(@Param('id') id: string) {
    return this.treasuryService.getDistribution(id);
  }
}