const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'UNAUTHORIZED',
        message: 'No token provided',
        meta: {
          request_id: req.id
        }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message, requestId: req.id });
    
    return res.status(401).json({
      success: false,
      data: null,
      error: 'UNAUTHORIZED',
      message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      meta: {
        request_id: req.id
      }
    });
  }
};

module.exports = authenticate;
