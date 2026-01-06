#!/bin/bash
# First-time Setup Script for ROF (Report of Findings)
# Run this ONCE on a new server to set up the environment
set -e

echo "🔧 Setting up ROF application..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration - UPDATE THESE
APP_DIR="/var/www/ROF"
DOMAIN="ai.drshumard.com"


# Step 3: Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}📦 Creating package.json...${NC}"
    cat > package.json << 'EOF'
{
  "name": "rof-app",
  "version": "1.0.0",
  "description": "Report of Findings - Patient Analysis Workflow",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF
fi

# Step 4: Install Node.js dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
npm install --production

# Step 5: Create PM2 log directory
echo -e "${YELLOW}📋 Setting up logging...${NC}"
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# Step 6: Start with PM2
echo -e "${YELLOW}🚀 Starting application with PM2...${NC}"
pm2 start ecosystem.config.js --env production

# Step 7: Set PM2 to start on boot
echo -e "${YELLOW}🔄 Configuring PM2 startup...${NC}"
pm2 save
pm2 startup | tail -1 | bash || true

# Step 8: Setup Nginx (if nginx is installed)
if command -v nginx &> /dev/null; then
    echo -e "${YELLOW}🌐 Setting up Nginx...${NC}"
    sudo cp nginx-rof.conf /etc/nginx/sites-available/rof
    sudo ln -sf /etc/nginx/sites-available/rof /etc/nginx/sites-enabled/
    
    # Test nginx config
    if sudo nginx -t; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx configured${NC}"
    else
        echo -e "${RED}❌ Nginx config has errors${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Nginx not installed. Skipping web server setup.${NC}"
fi

# Step 9: Setup SSL with Let's Encrypt (optional)
echo ""
echo -e "${YELLOW}🔐 SSL Certificate Setup${NC}"
echo "To set up HTTPS, run:"
echo "  sudo certbot --nginx -d $DOMAIN"
echo ""

# Done!
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ ROF Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Update n8n webhook URL to point to your server"
echo "  2. Set up SSL: sudo certbot --nginx -d $DOMAIN"
echo "  3. Test the app: curl http://localhost:3005/health"
echo ""
echo -e "App running at: http://localhost:3005"
pm2 status