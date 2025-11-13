const axios = require('axios');
const logger = require('../utils/logger');

class FCMProvider {
  constructor() {
    this.serverKey = process.env.FCM_SERVER_KEY;
    this.fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    
    if (this.serverKey) {
      logger.info('FCM provider initialized');
    } else {
      logger.warn('FCM server key not configured');
    }
  }

  isConfigured() {
    return !!this.serverKey;
  }

  validateToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Token is missing or invalid type' };
    }

    if (token.length < 20) {
      return { valid: false, reason: 'Token too short' };
    }

    const validPrefixes = ['AAAA', 'APA91', 'c', 'd', 'e', 'f'];
    const hasValidPrefix = validPrefixes.some(prefix => token.startsWith(prefix));
    
    if (!hasValidPrefix && !token.includes(':')) {
      logger.warn('Token format may be invalid', { tokenPrefix: token.substring(0, 10) });
    }

    return { valid: true };
  }

  async sendPushNotification({ token, title, body, data = {}, image, link, sound = 'default', badge, priority = 'high' }) {
    if (!this.isConfigured()) {
      throw new Error('FCM is not configured');
    }

    const tokenValidation = this.validateToken(token);
    if (!tokenValidation.valid) {
      throw new Error(`Invalid device token: ${tokenValidation.reason}`);
    }

    const payload = {
      to: token,
      priority,
      notification: {
        title,
        body,
        sound,
        click_action: link || undefined,
        icon: 'ic_notification',
        color: '#4CAF50'
      },
      data: {
        ...data,
        click_action: link || undefined,
        timestamp: new Date().toISOString()
      }
    };

    if (image) {
      payload.notification.image = image;
    }

    if (badge !== undefined) {
      payload.notification.badge = badge;
    }

    if (link) {
      payload.webpush = {
        fcm_options: {
          link
        }
      };
    }

    logger.info('Sending push notification via FCM', {
      title,
      tokenPrefix: token.substring(0, 15) + '...'
    });

    try {
      const response = await axios.post(
        this.fcmUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${this.serverKey}`
          },
          timeout: 10000
        }
      );

      if (response.data.failure === 1 && response.data.results) {
        const error = response.data.results[0].error;
        
        if (error === 'InvalidRegistration' || error === 'NotRegistered') {
          throw new Error(`Invalid or expired token: ${error}`);
        }
        
        throw new Error(`FCM error: ${error}`);
      }

      logger.info('Push notification sent successfully via FCM', {
        messageId: response.data.results ? response.data.results[0].message_id : response.data.message_id,
        success: response.data.success
      });

      return {
        success: true,
        messageId: response.data.results ? response.data.results[0].message_id : response.data.message_id,
        provider: 'fcm',
        multicastId: response.data.multicast_id
      };
    } catch (error) {
      if (error.response) {
        logger.error('FCM API error', {
          status: error.response.status,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          throw new Error('FCM authentication failed - check server key');
        }
        
        if (error.response.status === 400) {
          throw new Error('Invalid FCM request payload');
        }
      }
      
      throw error;
    }
  }

  async sendMulticast({ tokens, title, body, data = {}, image, link }) {
    if (!this.isConfigured()) {
      throw new Error('FCM is not configured');
    }

    const validTokens = [];
    const invalidTokens = [];

    for (const token of tokens) {
      const validation = this.validateToken(token);
      if (validation.valid) {
        validTokens.push(token);
      } else {
        invalidTokens.push({ token, reason: validation.reason });
      }
    }

    if (validTokens.length === 0) {
      throw new Error('No valid tokens provided');
    }

    if (invalidTokens.length > 0) {
      logger.warn('Some tokens were invalid', {
        invalidCount: invalidTokens.length,
        totalCount: tokens.length
      });
    }

    const payload = {
      registration_ids: validTokens,
      priority: 'high',
      notification: {
        title,
        body,
        sound: 'default',
        icon: 'ic_notification',
        color: '#4CAF50'
      },
      data: {
        ...data,
        click_action: link || undefined,
        timestamp: new Date().toISOString()
      }
    };

    if (image) {
      payload.notification.image = image;
    }

    logger.info('Sending multicast push notification', {
      recipientCount: validTokens.length,
      title
    });

    const response = await axios.post(
      this.fcmUrl,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${this.serverKey}`
        },
        timeout: 15000
      }
    );

    logger.info('Multicast notification sent', {
      success: response.data.success,
      failure: response.data.failure,
      multicastId: response.data.multicast_id
    });

    return {
      success: true,
      successCount: response.data.success,
      failureCount: response.data.failure,
      multicastId: response.data.multicast_id,
      provider: 'fcm',
      invalidTokens
    };
  }
}

module.exports = FCMProvider;
