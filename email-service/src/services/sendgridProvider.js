const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

class SendGridProvider {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM;
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Notification System';
    
    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
      logger.info('SendGrid provider initialized');
    } else {
      logger.warn('SendGrid API key not configured');
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async sendEmail({ to, subject, html, text, replyTo, attachments }) {
    if (!this.isConfigured()) {
      throw new Error('SendGrid is not configured');
    }

    const msg = {
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject,
      html,
      text: text || this.stripHtml(html),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    if (replyTo) {
      msg.replyTo = replyTo;
    }

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments.map(att => ({
        content: att.content,
        filename: att.filename,
        type: att.type || 'application/octet-stream',
        disposition: att.disposition || 'attachment'
      }));
    }

    logger.info('Sending email via SendGrid', {
      to,
      subject,
      from: this.fromEmail
    });

    const response = await sgMail.send(msg);
    
    logger.info('Email sent successfully via SendGrid', {
      to,
      messageId: response[0].headers['x-message-id'],
      statusCode: response[0].statusCode
    });

    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      provider: 'sendgrid'
    };
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }
}

module.exports = SendGridProvider;
