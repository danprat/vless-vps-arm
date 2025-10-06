# Production Setup - Step by Step Guide
# Domain: support.zoom.us.dany.qzz.io
# Port: 443 (HTTPS/TLS)
# Backend: Port 8790

## 📋 Prerequisites Check

echo "=== Checking Prerequisites ==="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Please run as root or use sudo"
    exit 1
fi

# Check OS
echo "✓ OS: $(lsb_release -d | cut -f2)"

# Check if Docker is running
if docker ps > /dev/null 2>&1; then
    echo "✓ Docker is running"
else
    echo "✗ Docker is not running or not installed"
    exit 1
fi

# Check if vless-gateway container exists
if docker ps | grep -q vless-gateway; then
    echo "✓ vless-gateway container is running"
else
    echo "⚠️  vless-gateway container is not running"
fi

# Check if port 8790 is listening
if netstat -tlpn | grep -q :8790; then
    echo "✓ Port 8790 is listening"
else
    echo "✗ Port 8790 is not listening"
fi

echo ""
echo "=== Prerequisites check complete ==="
echo ""

## 🚀 Step 1: Install Nginx

echo "=== Step 1: Installing Nginx ==="
apt update
apt install nginx -y

# Check Nginx installation
if nginx -v > /dev/null 2>&1; then
    echo "✓ Nginx installed: $(nginx -v 2>&1)"
else
    echo "✗ Nginx installation failed"
    exit 1
fi

echo ""

## 🔐 Step 2: Generate SSL Certificate

echo "=== Step 2: Generating SSL Certificate ==="

# Create SSL directory
mkdir -p /etc/nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/self-signed.key \
  -out /etc/nginx/ssl/self-signed.crt \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=VLESS Gateway/CN=support.zoom.us.dany.qzz.io"

# Set permissions
chmod 600 /etc/nginx/ssl/self-signed.key
chmod 644 /etc/nginx/ssl/self-signed.crt

if [ -f /etc/nginx/ssl/self-signed.crt ]; then
    echo "✓ SSL certificate generated"
    echo "  Certificate: /etc/nginx/ssl/self-signed.crt"
    echo "  Private Key: /etc/nginx/ssl/self-signed.key"
else
    echo "✗ SSL certificate generation failed"
    exit 1
fi

echo ""

## 📝 Step 3: Create Nginx Configuration

echo "=== Step 3: Creating Nginx Configuration ==="

cat > /etc/nginx/sites-available/vless-gateway << 'EOF'
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name support.zoom.us.dany.qzz.io;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# VLESS/Trojan WebSocket on HTTPS (port 443)
server {
    listen 443 ssl http2;
    server_name support.zoom.us.dany.qzz.io;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/self-signed.crt;
    ssl_certificate_key /etc/nginx/ssl/self-signed.key;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logging
    access_log /var/log/nginx/vless-access.log;
    error_log /var/log/nginx/vless-error.log;
    
    # WebSocket proxy to backend
    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # WebSocket timeout settings
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        
        # Buffering settings for WebSocket
        proxy_buffering off;
    }
}

# Admin panel (optional - keep port 8790 for admin access)
server {
    listen 8790;
    server_name support.zoom.us.dany.qzz.io;
    
    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

echo "✓ Nginx configuration created: /etc/nginx/sites-available/vless-gateway"
echo ""

## 🔗 Step 4: Enable Site

echo "=== Step 4: Enabling Site ==="

# Remove default site if exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    echo "✓ Removed default site"
fi

# Enable vless-gateway site
ln -sf /etc/nginx/sites-available/vless-gateway /etc/nginx/sites-enabled/

echo "✓ Site enabled"
echo ""

## ✅ Step 5: Test Configuration

echo "=== Step 5: Testing Nginx Configuration ==="

nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Nginx configuration is valid"
else
    echo "✗ Nginx configuration has errors"
    exit 1
fi

echo ""

## 🔄 Step 6: Restart Nginx

echo "=== Step 6: Restarting Nginx ==="

systemctl restart nginx
systemctl enable nginx

if systemctl is-active --quiet nginx; then
    echo "✓ Nginx is running"
else
    echo "✗ Nginx failed to start"
    systemctl status nginx
    exit 1
fi

echo ""

## 🔥 Step 7: Configure Firewall

echo "=== Step 7: Configuring Firewall ==="

# Check if UFW is installed
if command -v ufw > /dev/null 2>&1; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8790/tcp
    echo "✓ Firewall rules added (UFW)"
    ufw status
elif command -v firewall-cmd > /dev/null 2>&1; then
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --permanent --add-port=8790/tcp
    firewall-cmd --reload
    echo "✓ Firewall rules added (firewalld)"
else
    echo "⚠️  No firewall detected (UFW or firewalld)"
    echo "   Please manually open ports: 80, 443, 8790"
fi

echo ""

## 🧪 Step 8: Test Setup

echo "=== Step 8: Testing Setup ==="
echo ""

echo "Testing localhost access..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8790/api/v1/myip | grep -q "200"; then
    echo "✓ Backend (port 8790) is responding"
else
    echo "⚠️  Backend might not be responding"
fi

echo ""
echo "Testing HTTPS..."
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/v1/myip | grep -q "200"; then
    echo "✓ HTTPS proxy is working"
else
    echo "⚠️  HTTPS proxy might not be working"
fi

echo ""

## 📊 Step 9: Summary

echo "=========================================="
echo "     🎉 PRODUCTION SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "✅ Setup Summary:"
echo "   - Nginx installed and configured"
echo "   - SSL certificate generated"
echo "   - Ports 80, 443, 8790 configured"
echo "   - WebSocket support enabled"
echo ""
echo "📍 Access URLs:"
echo "   - Admin Panel: http://support.zoom.us.dany.qzz.io:8790/sub"
echo "   - Public HTTPS: https://support.zoom.us.dany.qzz.io/sub"
echo "   - API: https://support.zoom.us.dany.qzz.io/api/v1/myip"
echo ""
echo "🔐 WebSocket Endpoints:"
echo "   - WSS: wss://support.zoom.us.dany.qzz.io/<proxy-ip>-<port>"
echo ""
echo "📝 Next Steps:"
echo "   1. Go to Cloudflare Dashboard"
echo "   2. SSL/TLS → Overview → Set to 'Full' mode"
echo "   3. Network → Enable 'WebSockets'"
echo "   4. Test VLESS connection with TLS enabled"
echo ""
echo "🔍 Useful Commands:"
echo "   - Check Nginx status: systemctl status nginx"
echo "   - View logs: tail -f /var/log/nginx/vless-error.log"
echo "   - Test config: nginx -t"
echo "   - Restart Nginx: systemctl restart nginx"
echo ""
echo "=========================================="
