import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  FreeBetVoucherService,
  PaginatedVouchers,
} from './free-bet-vouchers.service';
import { CreateFreeBetVoucherDto } from './dto/create-free-bet-voucher.dto';
import { UpdateFreeBetVoucherDto } from './dto/update-free-bet-voucher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { FreeBetVoucher } from './entities/free-bet-voucher.entity';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: UserRole };
}

@Controller('free-bet-vouchers')
@UseGuards(JwtAuthGuard)
export class FreeBetVouchersController {
  constructor(private readonly freeBetVoucherService: FreeBetVoucherService) {}

  /**
   * Create a free bet voucher (admin).
   * POST /free-bet-vouchers
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createVoucher(
    @Body() dto: CreateFreeBetVoucherDto,
  ): Promise<FreeBetVoucher> {
    return this.freeBetVoucherService.createVoucher(dto);
  }

  /**
   * Current user's vouchers (paginated). Default: active only (unused, not expired).
   * GET /free-bet-vouchers/my-vouchers
   */
  @Get('my-vouchers')
  async getMyVouchers(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('includeUsed') includeUsed?: string,
  ): Promise<PaginatedVouchers> {
    return this.freeBetVoucherService.getUserVouchers(
      req.user.userId,
      page,
      limit,
      includeUsed === 'true',
    );
  }

  /**
   * Available (unused, not expired) vouchers for placing a bet.
   * GET /free-bet-vouchers/available
   */
  @Get('available')
  async getAvailableVouchers(
    @Req() req: AuthenticatedRequest,
  ): Promise<FreeBetVoucher[]> {
    return this.freeBetVoucherService.getAvailableVouchers(req.user.userId);
  }

  /**
   * Current user's voucher stats.
   * GET /free-bet-vouchers/my-stats
   */
  @Get('my-stats')
  async getMyStats(@Req() req: AuthenticatedRequest) {
    return this.freeBetVoucherService.getUserVoucherStats(req.user.userId);
  }

  /**
   * Admin: list vouchers for a user.
   * GET /free-bet-vouchers/user/:userId
   */
  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserVouchers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('includeUsed') includeUsed?: string,
  ): Promise<PaginatedVouchers> {
    return this.freeBetVoucherService.getUserVouchers(
      userId,
      page,
      limit,
      includeUsed === 'true',
    );
  }

  /**
   * Get voucher by id. Ownership enforced for non-admins.
   * GET /free-bet-vouchers/:voucherId
   */
  @Get(':voucherId')
  async getVoucherById(
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<FreeBetVoucher> {
    const requesterUserId =
      req.user.role === UserRole.ADMIN ? undefined : req.user.userId;

    return this.freeBetVoucherService.getVoucherById(
      voucherId,
      requesterUserId,
    );
  }

  @Patch(':voucherId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateVoucher(
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
    @Body() dto: UpdateFreeBetVoucherDto,
  ): Promise<FreeBetVoucher> {
    return this.freeBetVoucherService.updateVoucher(voucherId, dto);
  }

  @Delete(':voucherId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteVoucher(
    @Param('voucherId', ParseUUIDPipe) voucherId: string,
  ): Promise<{ message: string }> {
    await this.freeBetVoucherService.deleteVoucher(voucherId);
    return { message: 'Voucher deleted successfully' };
  }
}
