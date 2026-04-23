import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as webpush from 'web-push';
import {
  BaseNotification,
  NotificationPreferences,
} from './notifications.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private readonly mailTransporter?: nodemailer.Transporter;
  private readonly hasWebPushConfig: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.mailTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }

    const publicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject = this.configService.get<string>('WEB_PUSH_SUBJECT');
    this.hasWebPushConfig = Boolean(publicKey && privateKey && subject);

    if (this.hasWebPushConfig) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    }
  }

  async deliver(
    notification: BaseNotification,
    preferences: NotificationPreferences,
    user: User,
  ): Promise<void> {
    await Promise.allSettled([
      this.sendEmail(notification, preferences, user),
      this.sendPush(notification, preferences, user),
    ]);
  }

  private async sendEmail(
    notification: BaseNotification,
    preferences: NotificationPreferences,
    user: User,
  ): Promise<void> {
    if (!preferences.emailNotifications || !this.mailTransporter || !user.email) {
      return;
    }

    try {
      const fromEmail =
        this.configService.get<string>('SMTP_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        'no-reply@renaissance.local';

      await this.mailTransporter.sendMail({
        from: fromEmail,
        to: user.email,
        subject: notification.title,
        text: notification.message,
        html: `<p>${notification.message}</p>`,
      });
    } catch (error) {
      this.logger.error(`Email delivery failed for ${notification.id}`, error);
    }
  }

  private async sendPush(
    notification: BaseNotification,
    preferences: NotificationPreferences,
    user: User,
  ): Promise<void> {
    if (!preferences.pushNotifications || !this.hasWebPushConfig) {
      return;
    }

    const pushSubscription = user.metadata?.pushSubscription;
    if (!pushSubscription?.endpoint || !pushSubscription?.keys) {
      return;
    }

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data ?? {},
          timestamp: notification.timestamp,
        }),
      );
    } catch (error) {
      this.logger.error(`Push delivery failed for ${notification.id}`, error);
    }
  }
}
