import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Webhook, WebhookSubscription, WebhookDeliveryLog } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Webhook,
      WebhookSubscription,
      WebhookDeliveryLog,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}