const axios = require('axios');
const logger = require('./logger');

const createServiceClient = (baseURL, serviceName) => {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  client.interceptors.request.use(
    (config) => {
      logger.info(`Outgoing request to ${serviceName}`, {
        method: config.method,
        url: config.url,
        data: config.data
      });
      return config;
    },
    (error) => {
      logger.error(`Request error to ${serviceName}`, { error: error.message });
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response) => {
      logger.info(`Response from ${serviceName}`, {
        status: response.status,
        url: response.config.url
      });
      return response;
    },
    (error) => {
      logger.error(`Response error from ${serviceName}`, {
        status: error.response?.status,
        message: error.message,
        url: error.config?.url
      });
      return Promise.reject(error);
    }
  );

  return client;
};

const userServiceClient = createServiceClient(
  process.env.USER_SERVICE_URL || 'http://localhost:3001',
  'user-service'
);

const templateServiceClient = createServiceClient(
  process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3004',
  'template-service'
);

const emailServiceClient = createServiceClient(
  process.env.EMAIL_SERVICE_URL || 'http://localhost:3002',
  'email-service'
);

const pushServiceClient = createServiceClient(
  process.env.PUSH_SERVICE_URL || 'http://localhost:3003',
  'push-service'
);

module.exports = {
  userServiceClient,
  templateServiceClient,
  emailServiceClient,
  pushServiceClient
};
