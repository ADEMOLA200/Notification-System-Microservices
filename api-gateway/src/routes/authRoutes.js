const express = require('express');
const router = express.Router();
const { userServiceClient } = require('../utils/httpClient');
const authenticate = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const response = await userServiceClient.post('/api/v1/auth/login', req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const response = await userServiceClient.post('/api/v1/auth/verify', {}, {
      headers: { Authorization: req.headers.authorization }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
