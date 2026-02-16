// ============================================
// Notification Service
// ============================================

import { WebhookClient } from 'discord.js';
import nodemailer from 'nodemailer';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface NotificationPayload {
  type: 'job_completed' | 'job_failed' | 'quota_warning' | 'system_alert';
  title: string;
  message: string;
  data?: any;
  userId?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private discordWebhook: WebhookClient | null = null;
  private emailTransporter: nodemailer.Transporter | null = null;

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initializeServices(): void {
    // Initialize Discord webhook
    if (config.notifications.discordWebhookUrl) {
      try {
        this.discordWebhook = new WebhookClient({
          url: config.notifications.discordWebhookUrl
        });
        logger.info('Discord webhook initialized');
      } catch (error) {
        logger.error('Failed to initialize Discord webhook:', error);
      }
    }

    // Initialize email transporter
    if (config.notifications.email.smtpHost) {
      try {
        this.emailTransporter = nodemailer.createTransport({
          host: config.notifications.email.smtpHost,
          port: config.notifications.email.smtpPort,
          secure: config.notifications.email.smtpPort === 465,
          auth: {
            user: config.notifications.email.smtpUser,
            pass: config.notifications.email.smtpPass
          }
        });
        logger.info('Email transporter initialized');
      } catch (error) {
        logger.error('Failed to initialize email transporter:', error);
      }
    }
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    logger.info('Sending notification', { type: payload.type, title: payload.title });

    const promises: Promise<void>[] = [];

    // Slack notification
    if (config.features.enableSlackNotifications && config.notifications.slackWebhookUrl) {
      promises.push(this.sendSlackNotification(payload));
    }

    // Discord notification
    if (this.discordWebhook) {
      promises.push(this.sendDiscordNotification(payload));
    }

    // Email notification
    if (config.features.enableEmailNotifications && this.emailTransporter) {
      promises.push(this.sendEmailNotification(payload));
    }

    await Promise.all(promises);
  }

  private async sendSlackNotification(payload: NotificationPayload): Promise<void> {
    try {
      //  Fixed: Dynamic import with error handling
      const slackWebhook = await import('@slack/webhook').catch(() => null);
      
      if (!slackWebhook) {
        logger.warn('Slack webhook package not installed. Install with: npm install @slack/webhook');
        return;
      }

      const { IncomingWebhook } = slackWebhook;
      const webhook = new IncomingWebhook(config.notifications.slackWebhookUrl!);

      const color = payload.type === 'job_completed' ? 'good' : 
                    payload.type === 'job_failed' ? 'danger' : 'warning';

      await webhook.send({
        attachments: [{
          color,
          title: payload.title,
          text: payload.message,
          fields: payload.data ? Object.entries(payload.data).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          })) : [],
          footer: 'Autonomous AI Agent',
          ts: String(Math.floor(Date.now() / 1000))  // ✅ Convert to string
        }]
      });

      logger.info('Slack notification sent');
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  private async sendDiscordNotification(payload: NotificationPayload): Promise<void> {
    if (!this.discordWebhook) return;

    try {
      const color = payload.type === 'job_completed' ? 0x00ff00 : 
                    payload.type === 'job_failed' ? 0xff0000 : 0xffa500;

      await this.discordWebhook.send({
        embeds: [{
          title: payload.title,
          description: payload.message,
          color,
          fields: payload.data ? Object.entries(payload.data).map(([key, value]) => ({
            name: key,
            value: String(value).substring(0, 1000),
            inline: true
          })) : [],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Autonomous AI Agent'
          }
        }]
      });

      logger.info('Discord notification sent');
    } catch (error) {
      logger.error('Failed to send Discord notification:', error);
    }
  }

  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    if (!this.emailTransporter) return;

    try {
      await this.emailTransporter.sendMail({
        from: config.notifications.email.from,
        to: payload.userId, // Would need to look up user's email
        subject: payload.title,
        html: `
          <h2>${payload.title}</h2>
          <p>${payload.message}</p>
          ${payload.data ? `<pre>${JSON.stringify(payload.data, null, 2)}</pre>` : ''}
        `
      });

      logger.info('Email notification sent');
    } catch (error) {
      logger.error('Failed to send email notification:', error);
    }
  }

  // Send job completion notification
  async sendJobCompletion(
    userId: string,
    jobId: string,
    query: string,
    success: boolean,
    result?: any
  ): Promise<void> {
    await this.sendNotification({
      type: success ? 'job_completed' : 'job_failed',
      title: success ? 'Scraping Job Completed' : 'Scraping Job Failed',
      message: success 
        ? `Your scraping job for "${query}" has completed successfully.`
        : `Your scraping job for "${query}" has failed.`,
      data: {
        jobId,
        query,
        totalSources: result?.totalSources,
        topServices: result?.topServices?.join(', ')
      },
      userId
    });
  }

  // Send quota warning
  async sendQuotaWarning(userId: string, usage: number, limit: number): Promise<void> {
    const percentage = Math.round((usage / limit) * 100);
    
    if (percentage >= 80) {
      await this.sendNotification({
        type: 'quota_warning',
        title: 'API Quota Warning',
        message: `You have used ${percentage}% of your monthly API quota (${usage}/${limit} requests).`,
        data: { usage, limit, percentage },
        userId
      });
    }
  }

  // Send system alert
  async sendSystemAlert(title: string, message: string, data?: any): Promise<void> {
    await this.sendNotification({
      type: 'system_alert',
      title,
      message,
      data
    });
  }
}

export const notificationService = NotificationService.getInstance();