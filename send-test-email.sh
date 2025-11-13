#!/bin/bash
#
# Send Test Email Notification
# This script creates a notification record and publishes to RabbitMQ
#

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Sending Test Email Notification${NC}\n"

# Configuration
USER_ID="${1:-e1ee21cc-ec10-4c45-9410-78bb3d6f450f}"
NOTIFICATION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
REQUEST_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TEMPLATE_CODE="WELCOME_EMAIL"

echo -e "${GREEN}✅ Generated IDs:${NC}"
echo "   User ID: $USER_ID"
echo "   Notification ID: $NOTIFICATION_ID"
echo "   Request ID: $REQUEST_ID"
echo ""

# 1. Create notification record in database
echo -e "${BLUE}Step 1: Creating notification record in database...${NC}"
psql "postgresql://postgres.xjvvuzcyhqjxswoxuhvs:SsJiBL62uVUSXRDN@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require" << EOF
INSERT INTO notifications 
(id, user_id, notification_type, template_code, status, variables, request_id, created_at, updated_at)
VALUES (
  '$NOTIFICATION_ID',
  '$USER_ID',
  'email',
  '$TEMPLATE_CODE',
  'pending',
  '{"subject": "Test Email", "name": "Test User", "company": "Test Company", "verification_link": "https://example.com/verify"}'::jsonb,
  '$REQUEST_ID',
  NOW(),
  NOW()
);
EOF

echo -e "${GREEN}✅ Notification record created${NC}\n"

# 2. Publish message to RabbitMQ
echo -e "${BLUE}Step 2: Publishing message to RabbitMQ...${NC}"
PAYLOAD=$(cat <<EOF
{
  "user_id": "$USER_ID",
  "template_code": "$TEMPLATE_CODE",
  "variables": {
    "subject": "Test Email",
    "name": "Test User",
    "company": "Test Company",
    "verification_link": "https://example.com/verify"
  },
  "request_id": "$REQUEST_ID",
  "notification_id": "$NOTIFICATION_ID"
}
EOF
)

curl -u admin:admin123 -X POST \
  http://localhost:15672/api/exchanges/%2F/notifications.direct/publish \
  -H "Content-Type: application/json" \
  -d "{
    \"properties\": {},
    \"routing_key\": \"email\",
    \"payload\": \"$(echo $PAYLOAD | jq -c . | sed 's/"/\\"/g')\",
    \"payload_encoding\": \"string\"
  }"

echo -e "\n${GREEN}✅ Message published to email queue${NC}\n"
echo -e "${BLUE}📧 Check email-service logs for processing...${NC}"
echo -e "${BLUE}   Expected: 'Email sent successfully'${NC}\n"
