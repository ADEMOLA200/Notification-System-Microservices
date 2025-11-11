const { Pool } = require('pg');
const logger = require('../utils/logger');

const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

dbPool.on('connect', () => {
  logger.info('New database connection established');
});

dbPool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

module.exports = { dbPool };
