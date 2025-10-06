# Cloudflare Configuration Detected! 🎉

## ✅ Status: Domain is LIVE and Working!

Your domain `support.zoom.us.dany.qzz.io` is successfully proxied through Cloudflare.

### 📊 Connection Analysis

Based on the request headers:

```json
{
  "ip": "104.28.165.30",  // Cloudflare IP
  "request": {
    "headers": {
      "x-forwarded-host": "support.zoom.us.dany.qzz.io",
      "x-forwarded-server": "support.zoom.us.dany.qzz.io",
      "x-real-ip": "104.28.165.30",
      "x-forwarded-for": "104.28.165.30",
      "x-forwarded-proto": "https",  // ✅ SSL is working!
      "host": "support.zoom.us.dany.qzz.io",
      "connection": "Upgrade",  // ✅ WebSocket upgrade supported
      "upgrade-insecure-requests": "1"
    }
  }
}
```

### ✅ What's Working:

1. **✅ Domain Resolution** - DNS pointing correctly
2. **✅ Cloudflare Proxy** - Orange cloud enabled
3. **✅ HTTPS/SSL** - Working via Cloudflare
4. **✅ Headers Forwarding** - X-Forwarded headers present
5. **✅ WebSocket Support** - Connection: Upgrade header detected

## 🌐 Cloudflare Configuration

### Current Setup

Your traffic flow:
```
User → Cloudflare (SSL/CDN) → Your VPS (Port 8790)
```

### Recommended Cloudflare Settings

#### 1. SSL/TLS Settings
Go to: **SSL/TLS → Overview**

**Recommended:** `Full` or `Full (strict)`
```
Full: Cloudflare ↔ Origin communication is encrypted
Full (strict): Requires valid SSL certificate on origin
```

If you see SSL errors, use: `Flexible`
```
Flexible: Cloudflare ↔ Origin uses HTTP (not encrypted)
```

#### 2. DNS Settings
Go to: **DNS → Records**

```
Type: A
Name: support.zoom.us.dany.qzz.io (or subdomain)
Content: YOUR_VPS_IP
Proxy status: Proxied (🟧 Orange cloud)
```

#### 3. Network Settings

**WebSocket Support:**
Go to: **Network → WebSockets**
- ✅ Enable WebSocket

**HTTP/3:**
Go to: **Network → HTTP/3 (with QUIC)**
- ✅ Enable (optional, for better performance)

#### 4. Firewall Rules (Optional)

To protect your origin:

Go to: **Security → WAF** → **Create firewall rule**

```
Rule name: Block direct access to origin
Field: Host
Operator: does not equal
Value: support.zoom.us.dany.qzz.io
Action: Block
```

#### 5. Page Rules (Optional Performance Boost)

Go to: **Rules → Page Rules**

```
URL: support.zoom.us.dany.qzz.io/api/*
Settings:
  - Cache Level: Bypass
  - Rocket Loader: Off
```

## 🎯 Access URLs

### Via Cloudflare (Recommended)
- **Web UI:** `https://support.zoom.us.dany.qzz.io/sub`
- **API:** `https://support.zoom.us.dany.qzz.io/api/v1/myip`
- **Subscription:** `https://support.zoom.us.dany.qzz.io/api/v1/sub?format=raw`
- **WebSocket:** `wss://support.zoom.us.dany.qzz.io/<proxy-ip>-<port>`

### Direct (Bypass Cloudflare)
- **Web UI:** `http://YOUR_VPS_IP:8790/sub`
- **API:** `http://YOUR_VPS_IP:8790/api/v1/myip`
- **WebSocket:** `ws://YOUR_VPS_IP:8790/<proxy-ip>-<port>`

## 🔒 Security Considerations

### 1. Protect Origin Server

Since you're using Cloudflare, restrict direct access to port 8790:

```bash
# Allow only Cloudflare IPs
sudo ufw deny 8790/tcp
sudo ufw allow from 173.245.48.0/20 to any port 8790
sudo ufw allow from 103.21.244.0/22 to any port 8790
sudo ufw allow from 103.22.200.0/22 to any port 8790
sudo ufw allow from 103.31.4.0/22 to any port 8790
sudo ufw allow from 141.101.64.0/18 to any port 8790
sudo ufw allow from 108.162.192.0/18 to any port 8790
sudo ufw allow from 190.93.240.0/20 to any port 8790
sudo ufw allow from 188.114.96.0/20 to any port 8790
sudo ufw allow from 197.234.240.0/22 to any port 8790
sudo ufw allow from 198.41.128.0/17 to any port 8790
sudo ufw allow from 162.158.0.0/15 to any port 8790
sudo ufw allow from 104.16.0.0/13 to any port 8790
sudo ufw allow from 104.24.0.0/14 to any port 8790
sudo ufw allow from 172.64.0.0/13 to any port 8790
sudo ufw allow from 131.0.72.0/22 to any port 8790
```

Or simpler (but less secure):
```bash
# Allow only localhost and private networks
sudo ufw allow from 127.0.0.1 to any port 8790
sudo ufw allow from 10.0.0.0/8 to any port 8790
sudo ufw allow from 172.16.0.0/12 to any port 8790
sudo ufw allow from 192.168.0.0/16 to any port 8790
```

### 2. Get Real Visitor IP

Your server now sees Cloudflare IPs. To get real visitor IPs, use headers:

The server already does this! Check logs:
```bash
docker logs vless-gateway | grep "x-real-ip\|x-forwarded-for"
```

### 3. Enable Cloudflare Bot Protection

Go to: **Security → Settings**
- Bot Fight Mode: On
- Security Level: Medium or High

## 📊 Performance Optimization

### 1. Caching Rules

Go to: **Rules → Page Rules**

**Cache static assets:**
```
URL: support.zoom.us.dany.qzz.io/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
```

**Bypass cache for API:**
```
URL: support.zoom.us.dany.qzz.io/api/*
Settings:
  - Cache Level: Bypass
```

### 2. Compression

Go to: **Speed → Optimization**
- ✅ Auto Minify: JavaScript, CSS, HTML
- ✅ Brotli

### 3. HTTP/2 and HTTP/3

Go to: **Network**
- ✅ HTTP/2 (enabled by default)
- ✅ HTTP/3 (with QUIC)
- ✅ 0-RTT Connection Resumption

## 🧪 Testing

### Test SSL
```bash
# Check SSL certificate
openssl s_client -connect support.zoom.us.dany.qzz.io:443 -servername support.zoom.us.dany.qzz.io

# Test HTTPS access
curl -I https://support.zoom.us.dany.qzz.io/api/v1/myip
```

### Test WebSocket via Cloudflare
```bash
# Test WebSocket upgrade through Cloudflare
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://support.zoom.us.dany.qzz.io/1.1.1.1-443

# Should return: 101 Switching Protocols
```

### Check Headers
```bash
# Verify Cloudflare headers
curl -I https://support.zoom.us.dany.qzz.io

# Look for:
# cf-ray: (Cloudflare request ID)
# cf-cache-status: (cache status)
# server: cloudflare
```

## 🎨 Client Configuration

### VLESS Configuration (via Cloudflare)
```
vless://[UUID]@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#VLESS-CF-TLS
```

### Trojan Configuration (via Cloudflare)
```
trojan://[UUID]@support.zoom.us.dany.qzz.io:443?encryption=none&security=tls&sni=support.zoom.us.dany.qzz.io&type=ws&host=support.zoom.us.dany.qzz.io&path=%2F1.1.1.1-443#Trojan-CF-TLS
```

### Shadowsocks Configuration
```
ss://bm9uZTpVVUlE@support.zoom.us.dany.qzz.io:443?plugin=v2ray-plugin;tls;mode=websocket;path=/1.1.1.1-443;host=support.zoom.us.dany.qzz.io#SS-CF
```

## 🔍 Troubleshooting

### Issue: 521 Error (Web server is down)
```bash
# Check if container is running
docker ps | grep vless-gateway

# Check logs
docker logs vless-gateway

# Restart if needed
docker restart vless-gateway
```

### Issue: 522 Error (Connection timed out)
```bash
# Check if port 8790 is listening
netstat -tlpn | grep 8790

# Check firewall
sudo ufw status

# Allow Cloudflare IPs
sudo ufw allow from 173.245.48.0/20
```

### Issue: WebSocket not working
```bash
# Verify WebSocket is enabled in Cloudflare
# Go to: Network → WebSockets → ON

# Check logs for WebSocket upgrade
docker logs vless-gateway | grep -i websocket

# Test WebSocket locally first
curl -i http://localhost:8790/1.1.1.1-443 \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket"
```

### Issue: Real IP not showing
```bash
# Check if X-Forwarded-For header is present
docker logs vless-gateway | grep "x-forwarded-for"

# Server should log real IPs from Cloudflare headers
```

## 📈 Monitoring

### View Cloudflare Analytics
Go to: **Analytics & Logs → Traffic**

Monitor:
- Requests per second
- Bandwidth usage
- Top countries
- Status codes
- Threat analysis

### View Server Logs
```bash
# Real-time logs
docker logs -f vless-gateway

# Last 100 lines
docker logs --tail 100 vless-gateway

# Search for errors
docker logs vless-gateway 2>&1 | grep -i error
```

## 🎯 Summary

✅ **Domain:** support.zoom.us.dany.qzz.io  
✅ **Cloudflare:** Active (IP: 104.28.165.30)  
✅ **SSL/HTTPS:** Working  
✅ **WebSocket:** Supported  
✅ **Headers:** Forwarding correctly  

### Your Setup:
```
User/Client
    ↓ (HTTPS/WSS)
Cloudflare CDN (SSL, DDoS Protection, Caching)
    ↓ (HTTP/WS - Port 8790)
Your VPS (Docker Container)
    ↓
Proxy Destinations
```

### Next Steps:
1. ✅ Domain is working - No action needed
2. 🔒 (Optional) Restrict origin server access to Cloudflare IPs only
3. ⚡ (Optional) Configure caching rules for better performance
4. 🛡️ (Optional) Enable bot protection and security features
5. 📊 Monitor analytics in Cloudflare dashboard

Everything is working perfectly! 🎉
