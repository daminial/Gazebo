#!/bin/bash

# Script to obtain SSL certificates using certbot
# Usage: ./scripts/get-ssl.sh yourdomain.com your-email@example.com

if [ $# -ne 2 ]; then
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

echo "Obtaining SSL certificate for $DOMAIN..."

# Stop nginx temporarily if running
docker-compose -f scripts/docker-compose.yml stop frontend

# Get certificate
docker-compose -f scripts/docker-compose.yml --profile certbot run --rm certbot

# Copy certificates to ssl directory
mkdir -p scripts/ssl/live/$DOMAIN
cp scripts/letsencrypt/live/$DOMAIN/fullchain.pem scripts/ssl/live/$DOMAIN/
cp scripts/letsencrypt/live/$DOMAIN/privkey.pem scripts/ssl/live/$DOMAIN/

# Update nginx config with correct domain
sed -i "s/yourdomain.com/$DOMAIN/g" frontend/nginx/default.conf

# Restart services
docker-compose -f scripts/docker-compose.yml up --build -d

echo "SSL certificate obtained and configured!"
echo "Your site is now available at https://$DOMAIN"
