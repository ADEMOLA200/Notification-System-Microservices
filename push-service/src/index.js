require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const { dbPool } = require('./database/connection');
const { connectRabbitMQ, consumeQueue } = require('./queue/rabbitmq');
const errorHandler = require('./middleware/errorHandler');
const { processPushNotification } = require('./services/pushProcessor');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.id = require('uuid').v4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.id });
  next();
});

app.get('/health', async (req, res) => {
  try {
    const dbCheck = await dbPool.query('SELECT NOW()');
    
    res.json({
      success: true,
      data: {
        service: 'push-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbCheck.rows ? 'connected' : 'disconnected'
      },
      error: null,
      message: 'Service is healthy',
      meta: {
        request_id: req.id
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message, requestId: req.id });
    res.status(503).json({
      success: false,
      data: null,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service health check failed',
      meta: {
        request_id: req.id
      }
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: 'NOT_FOUND',
    message: 'Route not found',
    meta: {
      request_id: req.id
    }
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await dbPool.query('SELECT NOW()');
    logger.info('Database connected successfully');

    await connectRabbitMQ();
    logger.info('RabbitMQ connected successfully');

    await consumeQueue('push.queue', processPushNotification);
    logger.info('Started consuming push queue');

    app.listen(PORT, () => {
      logger.info(`Push Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await dbPool.end();
  process.exit(0);
});

startServer();

module.exports = app;
