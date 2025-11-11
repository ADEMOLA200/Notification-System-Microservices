# Local Development Setup

Quick guide to run the services locally without Docker.

## Prerequisites

Install these first:

```bash
# macOS
brew install redis
brew install rabbitmq
brew install node  # or use nvm

# Verify installations
node --version   # Should be 18+
redis-cli --version
rabbitmqctl version
```

## Step 1: Start Infrastructure

Start Redis and RabbitMQ before running the services.

```bash
# Start Redis
brew services start redis

# Verify Redis
redis-cli ping
# Should return: PONG

# Start RabbitMQ (in a separate terminal)
rabbitmq-server
# OR as background service
brew services start rabbitmq

# Verify RabbitMQ
curl http://localhost:15672
# Should show RabbitMQ management UI
```

## Step 2: Database Migrations

Run migrations once to create database tables.

```bash
cd user-service
npm install
npm run migrate
```

You should see:
```
✅ Connected to database, starting migrations...
✅ All migrations completed successfully
```

## Step 3: Configure Environment

Each service needs a `.env` file in its folder. Create these files:

### user-service/.env
```bash
DB_HOST=your-supabase-host.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_SSL=true

JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRY=7d
BCRYPT_ROUNDS=10

REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672

NODE_ENV=development
PORT=3001
```

### template-service/.env
```bash
DB_HOST=your-supabase-host.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_SSL=true

JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRY=7d

REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672

NODE_ENV=development
PORT=3004
```

### api-gateway/.env
```bash
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRY=7d

REDIS_URL=redis://localhost:6379

USER_SERVICE_URL=http://localhost:3001
TEMPLATE_SERVICE_URL=http://localhost:3004
EMAIL_SERVICE_URL=http://localhost:3002
PUSH_SERVICE_URL=http://localhost:3003

NODE_ENV=development
PORT=3000
```

**Important**: Replace placeholder values with your actual Supabase credentials (`your-supabase-host`, `your-database-user`, `your-database-password`) and generate a secure JWT secret (minimum 32 characters).

## Step 4: Start Services

Open separate terminals for each service.

### Terminal 1: User Service
```bash
cd user-service
npm install
npm run dev
```

Expected output:
```
✅ Database connected successfully
⚠️  Redis unavailable - continuing without cache
✅ User Service running on port 3001
```

### Terminal 2: Template Service
```bash
cd template-service
npm install
npm run dev
```

Expected output:
```
✅ Database connected successfully
⚠️  Redis unavailable - continuing without cache
✅ Template Service running on port 3004
```

### Terminal 3: API Gateway (Optional)
```bash
cd api-gateway
npm install
npm run dev
```

Expected output:
```
✅ API Gateway running on port 3000
```

### Terminal 4 & 5: Email & Push Services (Optional)
```bash
# Email Service
cd email-service
npm install
npm run dev

# Push Service (in another terminal)
cd push-service
npm install
npm run dev
```

## Step 5: Test the APIs

**Use Postman Collection**: https://www.postman.com/bold-star-347098/workspace/hng-microservices/collection/28821020-60b08838-8cae-4897-83aa-4f96594460b6

This collection has all endpoints pre-configured with examples and tests.

**Or test manually**:
```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3004/health

# Register a user
curl -X POST http://localhost:3001/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!"}'
```

## Common Issues

**Services won't start?**
- Check Redis is running: `redis-cli ping`
- Check RabbitMQ is running: `curl http://localhost:15672`
- Check .env files exist in each service folder
- Check database credentials are correct

**Port already in use?**
```bash
lsof -i :3001  # Find what's using the port
kill -9 <PID>  # Kill the process
```

**Database connection fails?**
- Verify your Supabase credentials
- Check DB_HOST is `aws-1-eu-west-1` not `aws-0-eu-west-1`
- Run migrations: `cd user-service && npm run migrate`

**Redis warnings?**
- Redis is optional. Services work without it (just slower).
- To fix: `brew services start redis`

## Stop Services

```bash
# Stop all Node services
pkill -f "node.*dev"

# Stop infrastructure
brew services stop redis
brew services stop rabbitmq
```

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 3000 | http://localhost:3000 |
| User Service | 3001 | http://localhost:3001 |
| Email Service | 3002 | http://localhost:3002 |
| Push Service | 3003 | http://localhost:3003 |
| Template Service | 3004 | http://localhost:3004 |
| Redis | 6379 | localhost:6379 |
| RabbitMQ | 5672 | localhost:5672 |
| RabbitMQ UI | 15672 | http://localhost:15672 |

## Development Tips

- Use `nodemon` - changes auto-reload
- Check logs in the terminal where service is running
- Use Postman collection for faster testing
- Redis is optional for development
- Services can run independently (don't need all running)

## Docker Alternative

If you prefer Docker:

```bash
docker-compose up --build
```

This starts everything (all services, Redis, RabbitMQ) automatically.
