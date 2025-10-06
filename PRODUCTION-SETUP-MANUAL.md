# Production Setup Manual - support.zoom.us.dany.qzz.io

## 🎯 Goal
Setup Nginx sebagai reverse proxy di port 443 dengan SSL/TLS untuk VLESS connections melalui Cloudflare.

---

## 📋 Part 1: Server Setup (Di VPS Anda)

### Step 1: Install Nginx

```bash
# SSH ke VPS Anda
ssh root@your-vps-ip

# Update package list
sudo apt update

# Install Nginx
sudo apt install nginx -y

# Verify installation
nginx -v
# Output: nginx version: nginx/1.x.x
```

---

### Step 2: Generate SSL Certificate

```bash
# Create directory for SSL certificates
sudo mkdir -p /etc/nginx/ssl

# Generate self-signed certificate (valid for 1 year)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/self-signed.key \
  -out /etc/nginx/ssl/self-signed.crt \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=VLESS/CN=support.zoom.us.dany.qzz.io"

# Set proper permissions
sudo chmod 600 /etc/nginx/ssl/self-signed.key
sudo chmod 644 /etc/nginx/ssl/self-signed.crt

# Verify files created
ls -l /etc/nginx/ssl/
```

**Note:** Self-signed certificate is OK karena Cloudflare yang handle public SSL.

---

### Step 3: Create Nginx Configuration

**Option A: Using nano editor**

```bash
sudo nano /etc/nginx/sites-available/vless-gateway
```

**Option B: Using cat command**

```bash
sudo cat > /etc/nginx/sites-available/vless-gateway << 'ENDOFFILE'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name support.zoom.us.dany.qzz.io;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server for VLESS/Trojan
server {
    listen 443 ssl http2;
    server_name support.zoom.us.dany.qzz.io;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/self-signed.crt;
    ssl_certificate_key /etc/nginx/ssl/self-signed.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Logs
    access_log /var/log/nginx/vless-access.log;
    error_log /var/log/nginx/vless-error.log;
    
    # Proxy to backend
    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}
ENDOFFILE
```

---

### Step 4: Enable the Site

```bash
# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Enable vless-gateway site
sudo ln -s /etc/nginx/sites-available/vless-gateway /etc/nginx/sites-enabled/

# Verify symlink created
ls -l /etc/nginx/sites-enabled/
```

---

### Step 5: Test Nginx Configuration

```bash
# Test configuration syntax
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**If you see errors:** Check your config file for typos.

---

### Step 6: Restart Nginx

```bash
# Restart Nginx service
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx

# Should show: Active: active (running)
```

---

### Step 7: Configure Firewall

**For Ubuntu/Debian (UFW):**

```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow admin port (optional)
sudo ufw allow 8790/tcp

# Enable firewall (if not already enabled)
sudo ufw enable

# Check status
sudo ufw status
```

**For CentOS/RHEL (firewalld):**

```bash
# Allow ports
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=8790/tcp

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-ports
```

---

### Step 8: Test Local Access

```bash
# Test backend (should work)
curl http://localhost:8790/api/v1/myip

# Test HTTPS proxy (should work)
curl -k https://localhost/api/v1/myip

# Test WebSocket upgrade
curl -i -N -k \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://localhost/1.1.1.1-443

# Should return: HTTP/1.1 101 Switching Protocols
```

---

## 📋 Part 2: Cloudflare Configuration

### Step 1: SSL/TLS Settings

1. Login to Cloudflare Dashboard
2. Select your domain
3. Go to **SSL/TLS** → **Overview**
4. Set encryption mode to: **Full** (NOT Full Strict)

   ```
   Off → Flexible → Full ← SELECT THIS → Full (strict)
   ```

**Why Full?**
- Your server has SSL (self-signed)
- Cloudflare validates the connection
- End-to-end encryption maintained

---

### Step 2: Enable WebSocket

1. Go to **Network** tab
2. Find **WebSockets** option
3. Toggle to **ON** (enabled)

---

### Step 3: (Optional) Disable Bot Fight Mode

Bot Fight Mode dapat mengganggu WebSocket:

1. Go to **Security** → **Bots**
2. If "Bot Fight Mode" is enabled, consider disabling it
3. Or add rule to allow your clients

---

### Step 4: Verify DNS Settings

1. Go to **DNS** tab
2. Find record: `support.zoom.us.dany.qzz.io`
3. Make sure **Proxy status** is **Proxied** (orange cloud)
4. Type: `A`
5. Content: Your VPS IP

---

## 📋 Part 3: Testing & Verification

### Test 1: DNS Resolution

```bash
# Should return Cloudflare IPs (104.x.x.x or 172.x.x.x)
nslookup support.zoom.us.dany.qzz.io

# Or
dig support.zoom.us.dany.qzz.io +short
```

---

### Test 2: HTTP Redirect

```bash
# Should redirect to HTTPS
curl -I http://support.zoom.us.dany.qzz.io

# Look for: HTTP/1.1 301 Moved Permanently
# Location: https://support.zoom.us.dany.qzz.io/
```

---

### Test 3: HTTPS Access

```bash
# Should return 200 OK
curl -I https://support.zoom.us.dany.qzz.io/sub

# Check API
curl https://support.zoom.us.dany.qzz.io/api/v1/myip
```

---

### Test 4: WebSocket Connection

```bash
# Should return 101 Switching Protocols
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  https://support.zoom.us.dany.qzz.io/1.1.1.1-443
```

---

## 📋 Part 4: VLESS Client Configuration

### Configuration Format

```
Protocol: VLESS
Address: support.zoom.us.dany.qzz.io
Port: 443
UUID: [Your UUID from server]
Encryption: none
Network: ws (WebSocket)
Path: /[proxy-ip]-[proxy-port]  (e.g., /1.1.1.1-443)
Host: support.zoom.us.dany.qzz.io
TLS: enabled
SNI: support.zoom.us.dany.qzz.io
```

### URI Format

```
vless://[UUID]@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#VLESS-Cloudflare-TLS
```

### Example (Replace [UUID] with your actual UUID):

```
vless://00000000-0000-0000-0000-000000000000@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#VLESS-TLS
```

---

## 🔍 Troubleshooting

### Issue 1: Nginx Won't Start

**Check logs:**
```bash
sudo journalctl -xeu nginx.service
sudo tail -f /var/log/nginx/error.log
```

**Common causes:**
- Port already in use
- Config syntax error
- SSL file not found

**Fix:**
```bash
# Check what's using port 443
sudo lsof -i :443

# Test config
sudo nginx -t

# Check SSL files exist
ls -l /etc/nginx/ssl/
```

---

### Issue 2: 502 Bad Gateway

**Meaning:** Nginx can't reach backend (port 8790)

**Check:**
```bash
# Is container running?
docker ps | grep vless-gateway

# Is port 8790 listening?
netstat -tlpn | grep 8790

# Can localhost reach it?
curl http://localhost:8790/api/v1/myip
```

**Fix:**
```bash
# Restart container
docker restart vless-gateway

# Check container logs
docker logs vless-gateway
```

---

### Issue 3: WebSocket Connection Failed

**Check Nginx logs:**
```bash
sudo tail -f /var/log/nginx/vless-error.log
```

**Check Docker logs:**
```bash
docker logs -f vless-gateway | grep -i websocket
```

**Verify Cloudflare settings:**
- SSL/TLS = Full
- WebSockets = Enabled
- Bot Fight Mode = Disabled (or allowed)

---

### Issue 4: VLESS Client Can't Connect

**Test step by step:**

1. **Test HTTPS:**
   ```bash
   curl https://support.zoom.us.dany.qzz.io/api/v1/myip
   ```

2. **Test WebSocket:**
   ```bash
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     https://support.zoom.us.dany.qzz.io/test
   ```

3. **Check client config:**
   - Port: 443 (not 8790)
   - TLS: enabled
   - SNI: support.zoom.us.dany.qzz.io
   - Path: /[ip]-[port]

---

## 📊 Monitoring

### Check Nginx Status

```bash
# Service status
sudo systemctl status nginx

# Active connections
curl http://localhost/nginx_status
```

### View Access Logs

```bash
# Live tail
sudo tail -f /var/log/nginx/vless-access.log

# Last 50 lines
sudo tail -50 /var/log/nginx/vless-access.log
```

### View Error Logs

```bash
# Live tail
sudo tail -f /var/log/nginx/vless-error.log

# Search for errors
sudo grep -i error /var/log/nginx/vless-error.log
```

### Container Logs

```bash
# Live tail
docker logs -f vless-gateway

# Last 100 lines
docker logs --tail 100 vless-gateway

# Search for WebSocket
docker logs vless-gateway | grep -i websocket
```

---

## 🎯 Performance Optimization

### Enable HTTP/2

Already enabled in config:
```nginx
listen 443 ssl http2;
```

### Enable Gzip Compression

Add to `/etc/nginx/nginx.conf` in `http` block:

```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript;
```

### Increase Worker Connections

Edit `/etc/nginx/nginx.conf`:

```nginx
events {
    worker_connections 2048;
}
```

Apply changes:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 Security Hardening

### 1. Hide Nginx Version

Add to `http` block in `/etc/nginx/nginx.conf`:

```nginx
server_tokens off;
```

### 2. Rate Limiting

Add to config:

```nginx
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

server {
    ...
    limit_req zone=mylimit burst=20 nodelay;
}
```

### 3. Block Bad Bots

```nginx
# Block common bad bots
if ($http_user_agent ~* (bot|crawler|spider) ) {
    return 403;
}
```

---

## ✅ Success Checklist

- [ ] Nginx installed and running
- [ ] SSL certificate generated
- [ ] Configuration file created
- [ ] Site enabled in sites-enabled
- [ ] Nginx configuration test passed
- [ ] Nginx service restarted
- [ ] Firewall rules added (80, 443)
- [ ] Cloudflare SSL/TLS set to "Full"
- [ ] Cloudflare WebSockets enabled
- [ ] HTTPS access working
- [ ] WebSocket upgrade returning 101
- [ ] VLESS client connects successfully

---

## 📞 Support

If you encounter issues:

1. Check logs first (Nginx + Docker)
2. Verify all settings in Cloudflare
3. Test locally before testing through Cloudflare
4. Review CLOUDFLARE-FIX.md for common issues

---

## 📝 Quick Reference

### Useful Commands

```bash
# Restart services
sudo systemctl restart nginx
docker restart vless-gateway

# Check status
sudo systemctl status nginx
docker ps

# View logs
sudo tail -f /var/log/nginx/vless-error.log
docker logs -f vless-gateway

# Test configuration
sudo nginx -t
curl https://support.zoom.us.dany.qzz.io/api/v1/myip
```

### Important Files

```
/etc/nginx/sites-available/vless-gateway  - Main config
/etc/nginx/ssl/self-signed.crt           - SSL certificate
/etc/nginx/ssl/self-signed.key           - SSL private key
/var/log/nginx/vless-access.log          - Access logs
/var/log/nginx/vless-error.log           - Error logs
```

---

**Setup complete! Your VLESS gateway is now production-ready! 🎉**
