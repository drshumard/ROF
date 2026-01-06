#!/bin/bash
# Production Deployment Script for ROF (Report of Findings)
# Run this on your Lightsail server after git push
set -e  # Exit on any error

echo "🚀 Starting ROF production deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE FOR YOUR SETUP
APP_DIR="/var/www/ROF"
APP_NAME="rof-server"
DOMAIN="ai.drshumard.com"  # Update with your actual domain
PORT=3005

# Step 1: Pull latest code
echo -e "${YELLOW}📥 Pulling latest code from repository...${NC}"
cd $APP_DIR
git pull origin main

# Step 2: Install Node dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
npm install --production

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 3: Check if PM2 process exists
echo -e "${YELLOW}🔄 Restarting services...${NC}"

if pm2 describe $APP_NAME > /dev/null 2>&1; then
    # Process exists, restart it
    pm2 restart $APP_NAME
    echo -e "${GREEN}✅ Service restarted${NC}"
else
    # Process doesn't exist, start it
    echo -e "${YELLOW}Starting new PM2 process...${NC}"
    pm2 start server.js --name $APP_NAME --env production
    echo -e "${GREEN}✅ Service started${NC}"
fi

# Wait for service to start
sleep 3

# Step 4: Check status
echo -e "${YELLOW}📊 Checking service status...${NC}"
pm2 status $APP_NAME

# Step 5: Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:$PORT/health || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed!${NC}"
    echo "Response: $HEALTH_RESPONSE"
    echo -e "${YELLOW}Checking logs...${NC}"
    pm2 logs $APP_NAME --lines 20 --nostream
    exit 1
fi

# Step 6: Save PM2 config
pm2 save

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 ROF Deployment completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 App URL:     https://${DOMAIN}"
echo -e "  📡 Local:       http://localhost:${PORT}"
echo -e "  🔌 SSE Events:  http://localhost:${PORT}/events"
echo -e "  📊 Status API:  POST http://localhost:${PORT}/status"
echo -e "  ✅ Complete:    POST http://localhost:${PORT}/complete"
echo ""

# Show recent logs
echo -e "${YELLOW}📋 Recent logs:${NC}"
pm2 logs $APP_NAME --lines 10 --nostream