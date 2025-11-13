const axios = require('axios');
const { dbPool } = require('../database/connection');
const logger = require('../utils/logger');
const RetryHandler = require('../utils/retryHandler');
const CircuitBreaker = require('../utils/circuitBreaker');
const RateLimiter = require('../utils/rateLimiter');
const FCMProvider = require('./fcmProvider');

const retryHandler = new RetryHandler(5, 1000, 32000);
const templateServiceBreaker = new CircuitBreaker({
  name: 'TemplateService',
  failureThreshold: 5,
  resetTimeout: 60000
});
const fcmProviderBreaker = new CircuitBreaker({
  name: 'FCMProvider',
  failureThreshold: 3,
  resetTimeout: 30000
});
const pushRateLimiter = new RateLimiter({
  name: 'FCMProvider',
  maxRequests: 100,
  windowMs: 60000
});

const fcmProvider = new FCMProvider();

async function processPushNotification(message) {
  const client = await dbPool.connect();
  const startTime = Date.now();
  
  try {
    const { user_id, template_code, variables, request_id, notification_id, retry_count = 0 } = message;

    logger.info('Processing push notification', {
      notificationId: notification_id,
      userId: user_id,
      templateCode: template_code,
      requestId: request_id,
      retryCount: retry_count
    });

    await client.query(
      `UPDATE notifications 
       SET status = 'processing', 
           metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{retry_count}', $1::text::jsonb),
           updated_at = NOW()
       WHERE id = $2`,
      [retry_count, notification_id]
    );

    const userResult = await client.query(
      'SELECT push_token, first_name, last_name FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const { push_token, first_name, last_name } = userResult.rows[0];

    if (!push_token) {
      throw new Error('User has no push token registered');
    }

    const tokenValidation = fcmProvider.validateToken(push_token);
    if (!tokenValidation.valid) {
      throw new Error(`Invalid device token: ${tokenValidation.reason}`);
    }

    const renderedContent = await fetchTemplateWithRetry(template_code, variables, request_id);

    await pushRateLimiter.acquire();

    const pushResult = await sendPushWithRetry({
      token: push_token,
      title: variables.title || 'Notification',
      body: renderedContent,
      data: {
        notification_id,
        user_id,
        template_code,
        ...variables.data
      },
      image: variables.image,
      link: variables.link,
      badge: variables.badge,
      sound: variables.sound || 'default'
    }, request_id);

    const processingTime = Date.now() - startTime;

    await client.query(
      `UPDATE notifications 
       SET status = 'sent', 
           sent_at = NOW(),
           metadata = jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(
                   COALESCE(metadata, '{}'::jsonb), 
                   '{provider}', 
                   to_jsonb($1::text)
                 ),
                 '{message_id}',
                 to_jsonb($2::text)
               ),
               '{multicast_id}',
               to_jsonb($3::text)
             ),
             '{processing_time_ms}',
             to_jsonb($4::int)
           ),
           updated_at = NOW()
       WHERE id = $5`,
      [
        pushResult.provider, 
        pushResult.messageId, 
        pushResult.multicastId || 'N/A',
        processingTime, 
        notification_id
      ]
    );

    logger.info('Push notification sent successfully', { 
      notificationId: notification_id, 
      userId: user_id,
      provider: pushResult.provider,
      messageId: pushResult.messageId,
      processingTimeMs: processingTime,
      requestId: request_id,
      retryCount: retry_count
    });

    return { success: true, provider: pushResult.provider };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Failed to send push notification', { 
      error: error.message,
      stack: error.stack,
      message,
      processingTimeMs: processingTime
    });
    
    const isTokenError = error.message.includes('token') || error.message.includes('registration');
    const errorStatus = isTokenError ? 'failed_permanent' : 'failed';
    
    await client.query(
      `UPDATE notifications 
       SET status = $1, 
           metadata = jsonb_set(
             jsonb_set(
               COALESCE(metadata, '{}'::jsonb), 
               '{error}', 
               to_jsonb($2::text)
             ),
             '{failed_at}',
             to_jsonb($3::text)
           ),
           updated_at = NOW()
       WHERE id = $4`,
      [errorStatus, error.message, new Date().toISOString(), message.notification_id]
    );

    if (isTokenError) {
      await client.query(
        `UPDATE users SET push_token = NULL WHERE id = $1`,
        [message.user_id]
      );
      logger.warn('Cleared invalid push token for user', { userId: message.user_id });
    }

    throw error;
  } finally {
    client.release();
  }
}

async function fetchTemplateWithRetry(templateCode, variables, requestId) {
  const result = await retryHandler.executeWithRetry(
    async () => {
      return await templateServiceBreaker.execute(async () => {
        const response = await axios.post(
          `${process.env.TEMPLATE_SERVICE_URL}/api/v1/templates/${templateCode}/render`,
          { variables },
          { 
            timeout: 10000,
            headers: {
              'X-Request-ID': requestId
            }
          }
        );
        return response.data.data.rendered_content;
      });
    },
    { templateCode, requestId }
  );

  if (!result.success) {
    throw result.error;
  }

  return result.result;
}

async function sendPushWithRetry(pushData, requestId) {
  const result = await retryHandler.executeWithRetry(
    async () => {
      return await fcmProviderBreaker.execute(async () => {
        return await fcmProvider.sendPushNotification(pushData);
      });
    },
    { token: pushData.token.substring(0, 15) + '...', title: pushData.title, requestId }
  );

  if (!result.success) {
    throw result.error;
  }

  return result.result;
}

function getCircuitBreakerStats() {
  return {
    templateService: templateServiceBreaker.getState(),
    fcmProvider: fcmProviderBreaker.getState(),
    rateLimiter: pushRateLimiter.getStats()
  };
}

module.exports = { 
  processPushNotification,
  getCircuitBreakerStats
};
