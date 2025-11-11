const express = require('express');
const router = express.Router();
const { userServiceClient } = require('../utils/httpClient');
const authenticate = require('../middleware/authenticate');
const { strictLimiter } = require('../middleware/rateLimiter');

router.post('/', strictLimiter, async (req, res, next) => {
  try {
    const response = await userServiceClient.post('/api/v1/users', req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const response = await userServiceClient.get(`/api/v1/users/${req.params.id}`, {
      headers: { Authorization: req.headers.authorization }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const response = await userServiceClient.put(`/api/v1/users/${req.params.id}`, req.body, {
      headers: { Authorization: req.headers.authorization }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/preferences', authenticate, async (req, res, next) => {
  try {
    const response = await userServiceClient.patch(`/api/v1/users/${req.params.id}/preferences`, req.body, {
      headers: { Authorization: req.headers.authorization }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
