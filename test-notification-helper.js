#!/usr/bin/env node
/**
 * Test Notification Helper
 * 
 * This script mimics what the API Gateway does:
 * 1. Creates a notification record in the database
 * 2. Publishes message to RabbitMQ
 * 
 * Usage:
 *   node test-notification-helper.js email
 *   node test-notification-helper.js push
 */

require('dotenv').config({ path: './user-service/.env' });
const { Pool } = require('pg');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Get notification type from command line
const notificationType = process.argv[2] || 'email';
const validTypes = ['email', 'push'];

if (!validTypes.includes(notificationType)) {
  console.error(`❌ Invalid notification type: ${notificationType}`);
  console.error(`   Valid types: ${validTypes.join(', ')}`);
  process.exit(1);
}

// Test user ID (update this to your actual user ID)
const TEST_USER_ID = 'e1ee21cc-ec10-4c45-9410-78bb3d6f450f';

async function sendTestNotification() {
  let connection, channel, client;

  try {
    console.log(`\n🚀 Sending test ${notificationType} notification...\n`);

    // 1. Connect to database
    client = await dbPool.connect();
    console.log('✅ Connected to database');

    // 2. Verify user exists
    const userCheck = await client.query(
      'SELECT id, email, push_token FROM users WHERE id = $1',
      [TEST_USER_ID]
    );

    if (userCheck.rows.length === 0) {
      throw new Error(`User ${TEST_USER_ID} not found in database. Please update TEST_USER_ID in the script.`);
    }

    const user = userCheck.rows[0];
    console.log(`✅ User found: ${user.email}`);

    // 3. Create notification record
    const notificationId = uuidv4();
    const requestId = uuidv4();
    const templateCode = notificationType === 'email' ? 'WELCOME_EMAIL' : 'NEW_MESSAGE';
    
    const variables = notificationType === 'email' 
      ? {
          subject: 'Test Email from Helper Script',
          name: 'Test User',
          company: 'Test Company',
          verification_link: 'https://example.com/verify'
        }
      : {
          title: 'Test Push Notification',
          body: 'This is a test push notification from helper script',
          image: 'https://via.placeholder.com/300',
          link: 'https://example.com',
          badge: 1
        };

    await client.query(
      `INSERT INTO notifications 
       (id, user_id, notification_type, template_code, status, variables, request_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [notificationId, TEST_USER_ID, notificationType, templateCode, 'pending', JSON.stringify(variables), requestId]
    );

    console.log(`✅ Notification record created`);
    console.log(`   Notification ID: ${notificationId}`);
    console.log(`   Request ID: ${requestId}`);
    console.log(`   Template: ${templateCode}`);

    // 4. Connect to RabbitMQ
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    channel = await connection.createChannel();
    console.log('✅ Connected to RabbitMQ');

    // 5. Publish message to queue
    const queueName = notificationType === 'email' ? 'email' : 'push';
    const message = {
      user_id: TEST_USER_ID,
      template_code: templateCode,
      variables,
      request_id: requestId,
      notification_id: notificationId,
      retry_count: 0
    };

    await channel.assertExchange('notifications.direct', 'direct', { durable: true });
    
    channel.publish(
      'notifications.direct',
      queueName,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    console.log(`✅ Message published to ${queueName} queue`);
    console.log(`\n📧 Now check the ${notificationType}-service logs!`);
    console.log(`   Expected: Message processed successfully\n`);

    // Wait a bit for the message to be sent
    await new Promise(resolve => setTimeout(resolve, 500));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (channel) await channel.close();
    if (connection) await connection.close();
    if (client) client.release();
    await dbPool.end();
    
    console.log('✅ Connections closed\n');
    process.exit(0);
  }
}

// Run the test
sendTestNotification();
