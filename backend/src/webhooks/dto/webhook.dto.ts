import { IsString, IsUrl, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';
import { WebhookEvent, WebhookStatus } from '../entities';

export class CreateWebhookDto {
  @IsString()
  name: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  retryAttempts?: number;

  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  retryAttempts?: number;

  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}

export class WebhookSubscriptionDto {
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];
}

export class WebhookDeliveryQueryDto {
  @IsOptional()
  @IsString()
  webhookId?: string;

  @IsOptional()
  @IsEnum(WebhookEvent)
  event?: WebhookEvent;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}