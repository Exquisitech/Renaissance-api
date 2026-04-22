import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto, UpdateWebhookDto, WebhookSubscriptionDto } from './dto/webhook.dto';
import { WebhookEvent, DeliveryStatus } from './entities';
import { RequireAdminRole } from '../auth/decorators/admin-roles.decorator';
import { AdminRole } from '../auth/enums/admin-role.enum';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('webhooks')
@UseGuards(AdminRoleGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  // ==================== Webhook Configuration ====================

  @Post()
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async createWebhook(@Body() createDto: CreateWebhookDto) {
    return this.webhookService.createWebhook(createDto);
  }

  @Get()
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getWebhooks() {
    return this.webhookService.getWebhooks();
  }

  @Get('events')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getAvailableEvents() {
    return this.webhookService.getAvailableEvents();
  }

  @Get(':id')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getWebhook(@Param('id') id: string) {
    return this.webhookService.getWebhookById(id);
  }

  @Put(':id')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async updateWebhook(
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookDto,
  ) {
    return this.webhookService.updateWebhook(id, updateDto);
  }

  @Delete(':id')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async deleteWebhook(@Param('id') id: string) {
    await this.webhookService.deleteWebhook(id);
    return { message: 'Webhook deleted successfully' };
  }

  @Post(':id/toggle')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async toggleWebhook(@Param('id') id: string) {
    return this.webhookService.toggleWebhook(id);
  }

  @Post(':id/regenerate-secret')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async regenerateSecret(@Param('id') id: string) {
    const secret = await this.webhookService.regenerateSecret(id);
    return { secret };
  }

  // ==================== Event Subscriptions ====================

  @Put(':id/subscriptions')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async updateSubscriptions(
    @Param('id') id: string,
    @Body() subscriptionDto: WebhookSubscriptionDto,
  ) {
    return this.webhookService.updateSubscriptions(id, subscriptionDto.events);
  }

  // ==================== Delivery Logs ====================

  @Get(':id/deliveries')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getDeliveries(
    @Param('id') id: string,
    @Query() query: { event?: WebhookEvent; status?: DeliveryStatus; page?: number; limit?: number },
  ) {
    return this.webhookService.getDeliveryLogs({
      webhookId: id,
      ...query,
    });
  }

  @Get('deliveries/all')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getAllDeliveries(
    @Query() query: { event?: WebhookEvent; status?: DeliveryStatus; page?: number; limit?: number },
  ) {
    return this.webhookService.getDeliveryLogs(query);
  }

  @Get('deliveries/:deliveryId')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getDelivery(@Param('deliveryId') deliveryId: string) {
    return this.webhookService.getDeliveryLogById(deliveryId);
  }

  @Post('deliveries/:deliveryId/retry')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async retryDelivery(@Param('deliveryId') deliveryId: string) {
    return this.webhookService.retryDelivery(deliveryId);
  }

  // ==================== Health Monitoring ====================

  @Post(':id/health-check')
  @RequireAdminRole(AdminRole.SUPER_ADMIN)
  async checkHealth(@Param('id') id: string) {
    return this.webhookService.checkWebhookHealth(id);
  }

  @Get(':id/stats')
  @RequireAdminRole(AdminRole.SUPER_ADMIN, AdminRole.ANALYST)
  async getStats(@Param('id') id: string) {
    return this.webhookService.getWebhookStats(id);
  }
}