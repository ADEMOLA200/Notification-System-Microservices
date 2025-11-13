const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class SMTPProvider {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    });

    this.fromEmail = process.env.SMTP_FROM;
    logger.info('SMTP provider initialized');
  }

  isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  }

  async sendEmail({ to, subject, html, text, replyTo, attachments }) {
    if (!this.isConfigured()) {
      throw new Error('SMTP is not configured');
    }

    const mailOptions = {
      from: this.fromEmail,
      to,
      subject,
      html,
      text
    };

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    logger.info('Sending email via SMTP', {
      to,
      subject,
      from: this.fromEmail
    });

    const info = await this.transporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully via SMTP', {
      to,
      messageId: info.messageId,
      response: info.response
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: 'smtp'
    };
  }

  async verify() {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('SMTP verification failed', { error: error.message });
      return false;
    }
  }
}

module.exports = SMTPProvider;
