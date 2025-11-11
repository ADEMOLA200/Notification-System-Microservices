const express = require('express');
const router = express.Router();
const { templateServiceClient } = require('../utils/httpClient');
const authenticate = require('../middleware/authenticate');
const { strictLimiter, generalLimiter } = require('../middleware/rateLimiter');

router.post('/', authenticate, strictLimiter, async (req, res, next) => {
  try {
    const response = await templateServiceClient.post('/api/v1/templates', req.body, {
      headers: { Authorization: req.headers.authorization }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.get('/', generalLimiter, async (req, res, next) => {
  try {
    const response = await templateServiceClient.get('/api/v1/templates', {
      params: req.query
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.get('/:code', generalLimiter, async (req, res, next) => {
  try {
    const response = await templateServiceClient.get(`/api/v1/templates/${req.params.code}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.put('/:code', authenticate, strictLimiter, async (req, res, next) => {
  try {
    const response = await templateServiceClient.put(`/api/v1/templates/${req.params.code}`, req.body, {
      headers: { Authorization: req.headers.authorization }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

router.post('/:code/render', generalLimiter, async (req, res, next) => {
  try {
    const response = await templateServiceClient.post(`/api/v1/templates/${req.params.code}/render`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
