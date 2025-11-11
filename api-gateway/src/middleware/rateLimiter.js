const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      data: null,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      meta: {}
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

const authLimiter = createRateLimiter(15 * 60 * 1000, 5);
const generalLimiter = createRateLimiter(15 * 60 * 1000, 100);
const strictLimiter = createRateLimiter(15 * 60 * 1000, 20);

module.exports = {
  authLimiter,
  generalLimiter,
  strictLimiter
};
