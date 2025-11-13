const { Pool } = require('pg');
const logger = require('../utils/logger');

const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

dbPool.on('connect', (client) => {
  logger.info('New database connection established');
});

dbPool.on('error', (err, client) => {
  // Ignore connection termination errors from Supabase pooler
  if (err.message && err.message.includes('termination')) {
    logger.debug('Database connection closed by server (normal)', { error: err.message });
  } else {
    logger.error('Unexpected database error', { error: err.message });
  }
});

module.exports = { dbPool };
