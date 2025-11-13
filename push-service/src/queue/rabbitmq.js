const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const EXCHANGE_NAME = 'notifications.direct';
const PUSH_QUEUE = 'push.queue';
const FAILED_QUEUE = 'failed.queue';

async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });
    
    await channel.assertQueue(PUSH_QUEUE, { durable: true });
    await channel.bindQueue(PUSH_QUEUE, EXCHANGE_NAME, 'push');

    await channel.assertQueue(FAILED_QUEUE, { durable: true });

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed, attempting to reconnect...');
      setTimeout(connectRabbitMQ, 5000);
    });

    logger.info('RabbitMQ setup completed');
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ', { error: error.message });
    setTimeout(connectRabbitMQ, 5000);
  }
}

async function consumeQueue(queueName, processor) {
  try {
    await channel.prefetch(1);
    
    channel.consume(queueName, async (msg) => {
      if (msg) {
        const startTime = Date.now();
        let content;
        
        try {
          content = JSON.parse(msg.content.toString());
        } catch (parseError) {
          logger.error('Failed to parse message JSON', {
            error: parseError.message,
            rawContent: msg.content.toString().substring(0, 200),
            queue: queueName
          });
          // Malformed JSON - send to DLQ immediately
          channel.ack(msg);
          return;
        }
        
        try {
          const retryCount = content.retry_count || 0;
          
          logger.info('Processing message from queue', { 
            queue: queueName, 
            notificationId: content.notification_id,
            retryCount,
            deliveryTag: msg.fields.deliveryTag
          });

          content.retry_count = retryCount;
          await processor(content);

          channel.ack(msg);
          
          const processingTime = Date.now() - startTime;
          logger.info('Message processed successfully', { 
            queue: queueName,
            notificationId: content.notification_id,
            processingTimeMs: processingTime
          });
        } catch (error) {
          const processingTime = Date.now() - startTime;
          const retryCount = content?.retry_count || 0;
          const maxRetries = 3;
          
          logger.error('Failed to process message', { 
            error: error.message,
            stack: error.stack,
            queue: queueName,
            notificationId: content?.notification_id,
            retryCount,
            maxRetries,
            processingTimeMs: processingTime,
            redelivered: msg.fields.redelivered
          });

          const isPermanentError = error.message.includes('not found') || 
                                   error.message.includes('Invalid') ||
                                   error.message.includes('failed_permanent');
          
          if (isPermanentError) {
            logger.warn('Permanent error detected, moving to DLQ', {
              notificationId: content?.notification_id,
              error: error.message
            });
            
            const failedMessage = {
              ...content,
              error: error.message,
              failed_at: new Date().toISOString(),
              final_retry_count: retryCount
            };
            
            await publishToQueue(FAILED_QUEUE, failedMessage);
            channel.ack(msg);
          } else if (retryCount >= maxRetries) {
            logger.warn('Max retries exceeded, moving to DLQ', {
              notificationId: content?.notification_id,
              retryCount,
              maxRetries
            });
            
            const failedMessage = {
              ...content,
              error: error.message,
              failed_at: new Date().toISOString(),
              final_retry_count: retryCount
            };
            
            await publishToQueue(FAILED_QUEUE, failedMessage);
            channel.ack(msg);
          } else {
            logger.info('Requeuing message for retry', {
              notificationId: content?.notification_id,
              currentRetry: retryCount,
              nextRetry: retryCount + 1
            });
            
            content.retry_count = retryCount + 1;
            
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            setTimeout(async () => {
              try {
                await publishToQueue(queueName, content);
                channel.ack(msg);
              } catch (requeueError) {
                logger.error('Failed to requeue message', {
                  error: requeueError.message,
                  notificationId: content?.notification_id
                });
                channel.nack(msg, false, false);
              }
            }, delay);
          }
        }
      }
    });

    logger.info(`Started consuming queue: ${queueName}`);
  } catch (error) {
    logger.error('Failed to consume queue', { error: error.message, queue: queueName });
    throw error;
  }
}

async function publishToQueue(queueName, message) {
  try {
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    logger.info('Message published to queue', { queue: queueName });
  } catch (error) {
    logger.error('Failed to publish message', { error: error.message, queue: queueName });
    throw error;
  }
}

async function publishToExchange(exchange, routingKey, message) {
  try {
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    logger.info('Message published to exchange', { exchange, routingKey });
  } catch (error) {
    logger.error('Failed to publish to exchange', { error: error.message });
    throw error;
  }
}

module.exports = {
  connectRabbitMQ,
  consumeQueue,
  publishToQueue,
  publishToExchange
};
