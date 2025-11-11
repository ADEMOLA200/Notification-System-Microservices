# Notification System - Microservices

A distributed notification system built with Node.js microservices, PostgreSQL, Redis, and RabbitMQ.

## What's Inside

This project contains five microservices:

- **API Gateway** (Port 3000) - Main entry point that routes requests to other services
- **User Service** (Port 3001) - Handles user registration, authentication, and preferences
- **Template Service** (Port 3004) - Manages notification templates and renders them with variables
- **Email Service** (Port 3002) - Processes email notifications (ready for SendGrid/SMTP integration)
- **Push Service** (Port 3003) - Handles push notifications (ready for Firebase integration)

## Tech Stack

- **Node.js** with Express
- **PostgreSQL** (Supabase) for database
- **Redis** for caching (optional)
- **RabbitMQ** for message queuing
- **JWT** for authentication
- **Docker** for containerization

## Project Structure

```
.
├── api-gateway/          # API Gateway service
├── user-service/         # User management & auth
├── template-service/     # Template management
├── email-service/        # Email notifications
├── push-service/         # Push notifications
├── docker-compose.yml    # Docker orchestration
└── .env.example         # Environment template
```

## Quick Start

See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for setup instructions.

## API Documentation

**Postman Collection**: https://www.postman.com/bold-star-347098/workspace/hng-microservices/collection/28821020-60b08838-8cae-4897-83aa-4f96594460b6

Import this collection to test all endpoints with pre-configured requests.

**Swagger UI** (when services are running):
- API Gateway: http://localhost:3000/api-docs
- User Service: http://localhost:3001/api-docs
- Template Service: http://localhost:3004/api-docs

## Database Schema

**Users Table**
- User accounts with encrypted passwords
- Push tokens for notifications
- Notification preferences

**Templates Table**
- Template content with variable placeholders
- Multi-language support
- Version history

**Notifications Table**
- Notification delivery tracking
- Status monitoring
- Request history

## Features

**User Service**
- User registration with password hashing
- JWT authentication
- User preferences management
- Health monitoring

**Template Service**
- Create and manage templates
- Variable substitution (e.g., {{name}}, {{link}})
- Template versioning
- Multi-language support

**API Gateway**
- Request routing
- Rate limiting
- JWT validation
- Centralized error handling

## Environment Configuration

Each service needs a `.env` file with database credentials. See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for details.

Key variables:
- Database connection (Supabase PostgreSQL)
- JWT secret
- Redis URL (optional)
- RabbitMQ URL
- Service ports

## Development

Services use `nodemon` for hot reload during development. Changes to code automatically restart the service.

**Ports:**
- 3000: API Gateway
- 3001: User Service
- 3002: Email Service
- 3003: Push Service
- 3004: Template Service

## Docker Deployment

```bash
docker-compose up --build
```

All services, Redis, and RabbitMQ will start automatically.

## What's Ready

- ✅ User registration and authentication
- ✅ JWT token management
- ✅ Template CRUD operations
- ✅ Template rendering with variables
- ✅ Database migrations
- ✅ Health check endpoints
- ✅ API documentation
- ✅ RabbitMQ message queue setup

## What Needs Integration

- Email sending (SendGrid/SMTP) - skeleton ready
- Push notifications (Firebase FCM) - skeleton ready

These services consume from RabbitMQ queues and are ready for external API integration.
