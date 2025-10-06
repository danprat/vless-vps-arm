# Domain Setup Guide - support.zoom.us.dany.qzz.io

## 🌐 DNS Configuration

### Step 1: Point Domain to VPS

Add an A record in your DNS provider:

```
Type: A
Name: support.zoom.us.dany.qzz.io
Value: YOUR_VPS_IP_ADDRESS
TTL: 3600 (or Auto)
```

**Verify DNS:**
```bash
# Check if domain resolves to your VPS IP
nslookup support.zoom.us.dany.qzz.io
dig support.zoom.us.dany.qzz.io

# Or use online tool
# https://www.whatsmydns.net/#A/support.zoom.us.dany.qzz.io
```

## 🚀 Deploy with Domain

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  vless-gateway:
    build:
      context: https://github.com/danprat/vless-vps-arm.git
      dockerfile: Dockerfile
    container_name: vless-gateway
    restart: unless-stopped
    ports:
      - "8790:8790"
    environment:
      - PORT=8790
      - APP_DOMAIN=support.zoom.us.dany.qzz.io
      - PROXY_BANK_URL=https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt
      - KV_PROXY_URL=https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/kvProxyList.json
      - PORT_OPTIONS=443,80
      - PROTOCOL_OPTIONS=trojan,vless,ss
      - DNS_SERVER_ADDRESS=94.140.14.14
      - DNS_SERVER_PORT=53
      - PROXY_HEALTH_CHECK_API=https://id1.foolvpn.me/api/v1/check
      - CONVERTER_URL=https://api.foolvpn.me/convert
      - PROXY_PER_PAGE=24
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8790/api/v1/myip"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
networks:
  default:
    name: vless-network
```

## 🔒 SSL/TLS Setup (Recommended)

### Option 1: Using Nginx + Let's Encrypt (Recommended)

#### 1. Install Nginx and Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx -y
```

#### 2. Create Nginx Configuration

Create file: `/etc/nginx/sites-available/vless-gateway`

```nginx
server {
    listen 80;
    server_name support.zoom.us.dany.qzz.io;
    
    location / {
        proxy_pass http://localhost:8790;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

#### 3. Enable Site and Get SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/vless-gateway /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d support.zoom.us.dany.qzz.io

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

#### 4. Auto-renewal Setup

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot will automatically set up a cron job for renewal
```

### Option 2: Using Cloudflare (Easiest)

If your domain is on Cloudflare:

1. **Enable Cloudflare Proxy:**
   - Go to Cloudflare Dashboard → DNS
   - Make sure the proxy cloud icon is orange (enabled)

2. **SSL/TLS Settings:**
   - Go to SSL/TLS → Overview
   - Set to "Flexible" or "Full"

3. **Access:**
   - HTTPS: `https://support.zoom.us.dany.qzz.io/sub`
   - WebSocket: `wss://support.zoom.us.dany.qzz.io/<proxy-ip>-<port>`

### Option 3: Using Caddy (Automatic SSL)

```bash
# Install Caddy
curl https://getcaddy.com | bash -s personal

# Create Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
support.zoom.us.dany.qzz.io {
    reverse_proxy localhost:8790
}
EOF

# Start Caddy
sudo systemctl start caddy
sudo systemctl enable caddy
```

## 🎯 Access URLs

After SSL setup:

### HTTP (Port 8790)
- Main Page: `http://support.zoom.us.dany.qzz.io:8790/sub`
- API: `http://support.zoom.us.dany.qzz.io:8790/api/v1/myip`
- WebSocket: `ws://support.zoom.us.dany.qzz.io:8790/<proxy-ip>-<port>`

### HTTPS (with reverse proxy)
- Main Page: `https://support.zoom.us.dany.qzz.io/sub`
- API: `https://support.zoom.us.dany.qzz.io/api/v1/myip`
- WebSocket: `wss://support.zoom.us.dany.qzz.io/<proxy-ip>-<port>`

## ✅ Testing

### Test Domain Resolution
```bash
# Check DNS
nslookup support.zoom.us.dany.qzz.io

# Test HTTP access
curl http://support.zoom.us.dany.qzz.io:8790/api/v1/myip

# Test HTTPS (if configured)
curl https://support.zoom.us.dany.qzz.io/api/v1/myip
```

### Test WebSocket
```bash
# Test WebSocket upgrade (HTTP)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://support.zoom.us.dany.qzz.io:8790/1.1.1.1-443

# Test WebSocket upgrade (HTTPS - if configured)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://support.zoom.us.dany.qzz.io/1.1.1.1-443
```

## 🔥 Client Configuration Examples

### VLESS Configuration
```
vless://[UUID]@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#VLESS-TLS
```

### Trojan Configuration
```
trojan://[UUID]@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#Trojan-TLS
```

## 🛠️ Troubleshooting

### Domain not resolving
```bash
# Check DNS propagation
dig support.zoom.us.dany.qzz.io +trace

# Clear local DNS cache
# Linux
sudo systemd-resolve --flush-caches

# macOS
sudo dscacheutil -flushcache

# Windows
ipconfig /flushdns
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### WebSocket Connection Issues
```bash
# Check if Nginx is forwarding properly
sudo tail -f /var/log/nginx/access.log

# Check container logs
docker logs -f vless-gateway

# Test from inside server
curl http://localhost:8790/api/v1/myip
```

## 🔐 Security Recommendations

1. **Always use HTTPS/TLS in production**
2. **Enable firewall:**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 8790/tcp  # If accessing directly
   sudo ufw enable
   ```

3. **Hide backend port** (use reverse proxy only)
4. **Rate limiting** in Nginx:
   ```nginx
   limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;
   limit_req zone=mylimit burst=20 nodelay;
   ```

5. **Monitor logs regularly**
   ```bash
   docker logs --since 1h vless-gateway
   ```

## 📊 Performance Tips

1. **Enable Gzip in Nginx:**
   ```nginx
   gzip on;
   gzip_types text/plain application/json;
   ```

2. **Use HTTP/2:**
   ```nginx
   listen 443 ssl http2;
   ```

3. **Enable caching:**
   ```nginx
   proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
   proxy_cache my_cache;
   ```

## 📝 Notes

- Domain `support.zoom.us.dany.qzz.io` is your custom subdomain
- Make sure DNS is properly configured before SSL setup
- SSL certificates auto-renew with Certbot
- WebSocket connections work through reverse proxy
- Monitor certificate expiry dates

## 🆘 Support

If you need help:
1. Check DNS configuration first
2. Verify firewall rules
3. Check container logs: `docker logs vless-gateway`
4. Check reverse proxy logs (if using)
5. Test locally before exposing externally
