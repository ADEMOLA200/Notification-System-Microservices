const nodemailer = require('nodemailer');
const axios = require('axios');
const { dbPool } = require('../database/connection');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

async function processEmailNotification(message) {
  const client = await dbPool.connect();
  try {
    const { user_id, template_code, variables, request_id, notification_id } = message;

    await client.query(
      `UPDATE notifications SET status = 'processing' WHERE id = $1`,
      [notification_id]
    );

    const templateResponse = await axios.post(
      `${process.env.TEMPLATE_SERVICE_URL}/api/v1/templates/${template_code}/render`,
      { variables }
    );

    const { rendered_content } = templateResponse.data.data;

    const userResult = await client.query(
      'SELECT email FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const { email } = userResult.rows[0];

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: variables.subject || 'Notification',
      html: rendered_content
    });

    await client.query(
      `UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [notification_id]
    );

    logger.info('Email sent successfully', { 
      notificationId: notification_id, 
      userId: user_id,
      requestId: request_id 
    });

  } catch (error) {
    logger.error('Failed to send email', { error: error.message, message });
    
    await client.query(
      `UPDATE notifications 
       SET status = 'failed', 
           metadata = jsonb_set(metadata, '{error}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(error.message), message.notification_id]
    );

    throw error;
  } finally {
    client.release();
  }
}

module.exports = { processEmailNotification };
