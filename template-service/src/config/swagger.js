const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Template Service API',
      version: '1.0.0',
      description: 'Template management and rendering service for the distributed notification system'
    },
    servers: [
      {
        url: process.env.SERVICE_URL || 'http://localhost:3004',
        description: 'Template Service'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      { name: 'Templates', description: 'Template management operations' },
      { name: 'Health', description: 'Service health check' }
    ]
  },
  apis: ['./src/routes/*.js', './src/index.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
