import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from '../lib/notification-service';
import type { EmailOptions } from '../lib/notification-service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Email')
@Controller('email')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailController {
  @Post('send')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send an email' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  async sendEmail(@Body() body: EmailOptions) {
    return NotificationService.sendEmail(body);
  }

  @Post('transactional')
  @ApiOperation({ summary: 'Send a transactional email using predefined templates' })
  @ApiResponse({ status: 200, description: 'Transactional email sent successfully' })
  async sendTransactionalEmail(
    @Body() body: {
      to: string;
      template: 'welcome' | 'achievement' | 'bet_result' | 'withdrawal' | 'deposit';
      data: Record<string, any>;
    },
  ) {
    return NotificationService.sendTransactionalEmail(
      body.to,
      body.template,
      body.data,
    );
  }
}
