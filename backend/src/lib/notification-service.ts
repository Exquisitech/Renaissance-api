import fetch from 'node-fetch';
import * as nodemailer from 'nodemailer';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export class NotificationService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter
   * Should be called once during application startup
   */
  static initializeEmailTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (!user || !pass) {
      console.warn('SMTP credentials not configured. Email sending will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    console.log('Email transporter initialized successfully');
  }

  /**
   * Send email using nodemailer
   * Supports HTML and text content, attachments
   */
  static async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter) {
      this.initializeEmailTransporter();
    }

    if (!this.transporter) {
      return {
        success: false,
        error: 'Email transporter not configured. Please set SMTP environment variables.',
      };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Renaissance Platform" <noreply@renaissance.com>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`Email sent successfully to ${options.to}. Message ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error(`Failed to send email to ${options.to}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send transactional email with predefined templates
   */
  static async sendTransactionalEmail(
    to: string,
    template: 'welcome' | 'achievement' | 'bet_result' | 'withdrawal' | 'deposit',
    data: Record<string, any>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const templates = {
      welcome: {
        subject: 'Welcome to Renaissance Platform!',
        html: `
          <h1>Welcome to Renaissance!</h1>
          <p>Dear ${data.name || 'User'},</p>
          <p>Thank you for joining our platform. We're excited to have you on board!</p>
          <p>Get started by:</p>
          <ul>
            <li>Connecting your wallet</li>
            <li>Exploring available bets</li>
            <li>Completing your profile</li>
          </ul>
          <p>Best regards,<br>The Renaissance Team</p>
        `,
        text: `Welcome to Renaissance! Thank you for joining our platform.`,
      },
      achievement: {
        subject: '🏆 Achievement Unlocked!',
        html: `
          <h1>Congratulations!</h1>
          <p>You've unlocked a new achievement: <strong>${data.achievementName}</strong></p>
          <p>${data.description || ''}</p>
          <p>Reward Points Earned: ${data.rewardPoints || 0}</p>
          <p>Keep up the great work!</p>
        `,
        text: `Congratulations! You unlocked: ${data.achievementName}`,
      },
      bet_result: {
        subject: data.isWin ? '🎉 You Won!' : 'Better luck next time',
        html: `
          <h1>${data.isWin ? 'Congratulations!' : 'Better luck next time'}</h1>
          <p>Your bet on ${data.matchName || 'the match'} has been settled.</p>
          <p><strong>Result:</strong> ${data.isWin ? 'WIN' : 'LOSS'}</p>
          <p><strong>Amount:</strong> ${data.amount} XLM</p>
          ${data.isWin ? `<p><strong>Winnings:</strong> ${data.winnings} XLM</p>` : ''}
          <p>Keep playing and good luck!</p>
        `,
        text: `Your bet result: ${data.isWin ? 'WIN' : 'LOSS'}. Amount: ${data.amount} XLM`,
      },
      withdrawal: {
        subject: 'Withdrawal Processed',
        html: `
          <h1>Withdrawal Confirmation</h1>
          <p>Your withdrawal has been processed successfully.</p>
          <p><strong>Amount:</strong> ${data.amount} XLM</p>
          <p><strong>Transaction Hash:</strong> ${data.txHash || 'N/A'}</p>
          <p><strong>Destination:</strong> ${data.address}</p>
        `,
        text: `Withdrawal processed: ${data.amount} XLM`,
      },
      deposit: {
        subject: 'Deposit Received',
        html: `
          <h1>Deposit Confirmation</h1>
          <p>Your deposit has been received and credited to your account.</p>
          <p><strong>Amount:</strong> ${data.amount} XLM</p>
          <p><strong>Transaction Hash:</strong> ${data.txHash || 'N/A'}</p>
        `,
        text: `Deposit received: ${data.amount} XLM`,
      },
    };

    const templateData = templates[template];

    return this.sendEmail({
      to,
      subject: templateData.subject,
      html: templateData.html,
      text: templateData.text,
    });
  }

  static async fetchNotifications(
    userId: string,
    limit = 50,
    offset = 0,
    unreadOnly = false,
  ) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    params.append('unreadOnly', String(unreadOnly));

    const res = await fetch(
      `${BACKEND_URL}/notifications?${params.toString()}`,
    );
    if (!res.ok) throw new Error('Failed to fetch notifications');
    const body = await res.json();
    return body.notifications;
  }

  static async subscribe(userId: string) {
    // Return suggested websocket endpoint and a simple ephemeral token (for client usage)
    const wsUrl = process.env.WS_URL || 'ws://localhost:3000/notifications';
    const token = `sub_${userId}_${Date.now()}`;
    return { wsUrl, token };
  }

  static async markAsRead(userId: string, notificationId: string) {
    const res = await fetch(
      `${BACKEND_URL}/notifications/read/${notificationId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      },
    );
    if (!res.ok) throw new Error('Failed to mark read');
    return true;
  }
}
