require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { dbPool } = require('./database/connection');
const redisClient = require('./utils/redis');
const errorHandler = require('./middleware/errorHandler');
const swaggerSpec = require('./config/swagger');

const templateRoutes = require('./routes/templateRoutes');

const app = express();
const PORT = process.env.PORT || 3004;

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
    
    let redisStatus = 'disconnected';
    try {
      const redisCheck = await redisClient.ping();
      redisStatus = redisCheck === 'PONG' ? 'connected' : 'disconnected';
    } catch (redisError) {
      redisStatus = 'unavailable';
    }
    
    res.json({
      success: true,
      data: {
        service: 'template-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbCheck.rows ? 'connected' : 'disconnected',
        redis: redisStatus
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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Template Service API Docs'
}));

app.use('/api/v1/templates', templateRoutes);

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

    // Try Redis connection, but don't fail if unavailable
    try {
      await redisClient.connect();
      logger.info('Redis connected successfully');
    } catch (redisError) {
      logger.warn('Redis unavailable - continuing without cache', { 
        error: redisError.message 
      });
    }

    app.listen(PORT, () => {
      logger.info(`Template Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await dbPool.end();
  
  try {
    await redisClient.quit();
  } catch (err) {
    logger.warn('Redis already disconnected');
  }
  
  process.exit(0);
});

startServer();

module.exports = app;
