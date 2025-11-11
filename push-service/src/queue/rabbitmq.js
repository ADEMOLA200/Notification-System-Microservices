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
        try {
          const content = JSON.parse(msg.content.toString());
          logger.info('Processing message from queue', { queue: queueName, content });

          await processor(content);

          channel.ack(msg);
          logger.info('Message processed successfully', { queue: queueName });
        } catch (error) {
          logger.error('Failed to process message', { error: error.message, queue: queueName });
          
          if (msg.fields.redelivered) {
            await publishToQueue(FAILED_QUEUE, JSON.parse(msg.content.toString()));
            channel.ack(msg);
            logger.info('Message moved to failed queue');
          } else {
            channel.nack(msg, false, true);
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

module.exports = {
  connectRabbitMQ,
  consumeQueue,
  publishToQueue
};
