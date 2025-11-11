const axios = require('axios');
const { dbPool } = require('../database/connection');
const logger = require('../utils/logger');

async function processPushNotification(message) {
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
      'SELECT push_token FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const { push_token } = userResult.rows[0];

    if (!push_token) {
      throw new Error('User has no push token');
    }

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: push_token,
        notification: {
          title: variables.title || 'Notification',
          body: rendered_content,
          sound: 'default'
        },
        data: variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${process.env.FCM_SERVER_KEY}`
        }
      }
    );

    await client.query(
      `UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [notification_id]
    );

    logger.info('Push notification sent successfully', { 
      notificationId: notification_id, 
      userId: user_id,
      requestId: request_id 
    });

  } catch (error) {
    logger.error('Failed to send push notification', { error: error.message, message });
    
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

module.exports = { processPushNotification };
