# Cloudflare VLESS Connection Fix

## 🔍 Problem Analysis

Dari log request:
```json
{
  "ip": "104.28.165.30",  // Cloudflare IP
  "x-forwarded-proto": "https",  // Request datang via HTTPS
  "host": "support.zoom.us.dany.qzz.io",
  "connection": "Upgrade"  // WebSocket upgrade request
}
```

**Masalah yang terdeteksi:**
1. ❌ Traffic melalui Cloudflare proxy (orange cloud)
2. ❌ Cloudflare tidak mendukung WebSocket di port non-standard (8790)
3. ❌ Cloudflare memblokir atau mengubah WebSocket upgrade headers
4. ❌ HTTPS di Cloudflare tapi backend HTTP di port 8790

---

## ✅ Solution 1: Cloudflare Gray Cloud (Recommended - Paling Mudah)

### Disable Cloudflare Proxy

**Di Cloudflare Dashboard:**

1. Login ke Cloudflare → Pilih domain Anda
2. Klik **DNS** di menu
3. Cari record: `support.zoom.us.dany.qzz.io`
4. **Klik icon cloud orange** (Proxied) → Ubah jadi **Gray Cloud** (DNS Only)
5. Tunggu 1-2 menit untuk propagasi

**Setelah Gray Cloud:**
- ✅ Traffic langsung ke VPS Anda
- ✅ WebSocket bisa jalan di port 8790
- ✅ Tidak ada blocking dari Cloudflare
- ❌ Tidak ada DDoS protection
- ❌ IP VPS terlihat publik

**Test koneksi:**
```bash
curl http://support.zoom.us.dany.qzz.io:8790/api/v1/myip
```

---

## ✅ Solution 2: Cloudflare Orange Cloud + Port 443 (Production Ready)

Untuk tetap menggunakan Cloudflare protection, kita perlu setup proper SSL.

### Step 1: Update Docker Compose - Port 443

**Update konfigurasi di Portainer:**

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
      - "8790:8790"  # Keep this for admin
      - "443:443"    # Add this for VLESS/Trojan
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

### Step 2: Setup Nginx Reverse Proxy

**Install Nginx:**
```bash
sudo apt update
sudo apt install nginx -y
```

**Create config: `/etc/nginx/sites-available/vless-gateway`**

```nginx
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name support.zoom.us.dany.qzz.io;
    return 301 https://$server_name$request_uri;
}

# Admin panel on port 8790
server {
    listen 8790;
    server_name support.zoom.us.dany.qzz.io;
    
    location / {
        proxy_pass http://localhost:8790;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# VLESS/Trojan WebSocket on port 443
server {
    listen 443 ssl http2;
    server_name support.zoom.us.dany.qzz.io;
    
    # Self-signed SSL (Cloudflare will handle public SSL)
    ssl_certificate /etc/nginx/ssl/self-signed.crt;
    ssl_certificate_key /etc/nginx/ssl/self-signed.key;
    
    # WebSocket proxy to backend
    location / {
        proxy_pass http://localhost:8790;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

**Generate self-signed certificate:**
```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/self-signed.key \
  -out /etc/nginx/ssl/self-signed.crt \
  -subj "/CN=support.zoom.us.dany.qzz.io"
```

**Enable and restart:**
```bash
sudo ln -s /etc/nginx/sites-available/vless-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 3: Cloudflare Settings

**Di Cloudflare Dashboard:**

1. **SSL/TLS Settings:**
   - Go to SSL/TLS → Overview
   - Set encryption mode: **Full** (not Full Strict)

2. **Network Settings:**
   - Go to Network
   - Enable **WebSockets**
   - Enable **gRPC** (optional)

3. **Firewall (Optional):**
   - Go to Security → WAF
   - Add rule to allow your country/IP

### Step 4: Firewall Rules

```bash
# Allow ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8790/tcp
sudo ufw enable
```

---

## ✅ Solution 3: Cloudflare Tunnel (Zero Trust - Advanced)

Menggunakan Cloudflare Tunnel untuk expose service tanpa open port:

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create vless-gateway

# Configure tunnel
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: vless-gateway
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: support.zoom.us.dany.qzz.io
    service: http://localhost:8790
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run vless-gateway
```

---

## 🧪 Testing

### Test 1: Check Domain Resolution
```bash
nslookup support.zoom.us.dany.qzz.io
# Should return Cloudflare IP if Orange Cloud
# Should return your VPS IP if Gray Cloud
```

### Test 2: Test HTTP Access
```bash
# Gray Cloud (direct)
curl http://support.zoom.us.dany.qzz.io:8790/api/v1/myip

# Orange Cloud (via Cloudflare)
curl https://support.zoom.us.dany.qzz.io/api/v1/myip
```

### Test 3: Test WebSocket
```bash
# Gray Cloud
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://support.zoom.us.dany.qzz.io:8790/1.1.1.1-443

# Orange Cloud (with Nginx)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://support.zoom.us.dany.qzz.io/1.1.1.1-443
```

### Test 4: VLESS Client Config

**Gray Cloud (Direct):**
```
vless://[UUID]@support.zoom.us.dany.qzz.io:8790?encryption=none&security=none&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#VLESS-Direct
```

**Orange Cloud (via Cloudflare + Nginx):**
```
vless://[UUID]@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#VLESS-Cloudflare
```

---

## 🔍 Debug Commands

### Check if Cloudflare is proxying
```bash
dig support.zoom.us.dany.qzz.io +short
# Cloudflare IPs start with 104.x or 172.x
# Your VPS IP = Direct connection
```

### Check Nginx status
```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Check container ports
```bash
docker port vless-gateway
netstat -tlpn | grep -E '8790|443'
```

### Check WebSocket in logs
```bash
docker logs -f vless-gateway | grep -i websocket
```

---

## 📊 Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **Gray Cloud** | ✅ Easy setup<br>✅ Works immediately<br>✅ No configuration needed | ❌ No DDoS protection<br>❌ IP exposed<br>❌ No caching | Testing, Development |
| **Orange Cloud + Nginx** | ✅ DDoS protection<br>✅ Hide IP<br>✅ SSL termination<br>✅ Caching | ❌ Complex setup<br>❌ Need Nginx<br>❌ Need SSL config | Production, Public use |
| **Cloudflare Tunnel** | ✅ No port opening<br>✅ Zero Trust security<br>✅ Easy management | ❌ Need cloudflared<br>❌ Learning curve<br>❌ Extra service | Enterprise, High security |

---

## 🎯 Recommended Solution

**Untuk testing cepat:** → **Solution 1 (Gray Cloud)**  
**Untuk production:** → **Solution 2 (Orange Cloud + Nginx)**  
**Untuk enterprise:** → **Solution 3 (Cloudflare Tunnel)**

---

## 🆘 Still Not Working?

### Check Cloudflare Firewall
```bash
# Look for blocked requests in Cloudflare dashboard:
# Security → Overview → Activity Log
```

### Check Container Logs
```bash
docker logs --tail 100 vless-gateway
```

### Test from VPS directly
```bash
# Should work on localhost
curl http://localhost:8790/api/v1/myip
```

### Verify WebSocket headers
```bash
# Should see "101 Switching Protocols"
curl -i http://localhost:8790/test \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade"
```

---

## 📝 Quick Fix Summary

**Solusi tercepat (5 menit):**
1. Login Cloudflare
2. DNS → support.zoom.us.dany.qzz.io
3. Klik orange cloud → jadi gray cloud
4. Test: `curl http://support.zoom.us.dany.qzz.io:8790/api/v1/myip`
5. Update VLESS config ke port 8790
6. Done! ✅

**Solusi production (30 menit):**
1. Setup Nginx dengan config di atas
2. Generate self-signed SSL
3. Cloudflare → SSL/TLS → Full mode
4. Cloudflare → Network → Enable WebSocket
5. Update VLESS config ke port 443 dengan TLS
6. Done! ✅
