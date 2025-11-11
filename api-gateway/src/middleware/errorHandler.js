const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    requestId: req.id
  });

  if (err.response) {
    return res.status(err.response.status || 500).json({
      success: false,
      data: null,
      error: err.response.data?.error || 'SERVICE_ERROR',
      message: err.response.data?.message || 'Service request failed',
      meta: {
        request_id: req.id
      }
    });
  }

  res.status(500).json({
    success: false,
    data: null,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    meta: {
      request_id: req.id
    }
  });
};

module.exports = errorHandler;
