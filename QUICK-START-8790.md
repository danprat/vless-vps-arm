# Quick Reference - Port 8790 Setup

## 🚀 One-Click Portainer Deployment

**Copy-paste ini ke Portainer:**

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
      - APP_DOMAIN=localhost  # GANTI DENGAN DOMAIN/IP ANDA
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

## 🔥 Quick Commands

### Test HTTP Endpoint
```bash
curl http://localhost:8790/api/v1/myip
curl http://your-vps-ip:8790/sub
```

### Test WebSocket
```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:8790/1.1.1.1-443
```

### Check Port Status
```bash
# Linux
netstat -tlpn | grep 8790
ss -tlpn | grep 8790

# macOS
lsof -i :8790

# Docker
docker port vless-gateway
```

### View Logs
```bash
# Follow logs
docker logs -f vless-gateway

# Last 100 lines
docker logs --tail 100 vless-gateway

# Search for errors
docker logs vless-gateway 2>&1 | grep -i error
```

### Firewall Rules
```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 8790/tcp
sudo ufw status

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=8790/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports

# IPTables
sudo iptables -A INPUT -p tcp --dport 8790 -j ACCEPT
sudo iptables-save
```

## 🎯 Access URLs

| Endpoint | URL | Description |
|----------|-----|-------------|
| Web UI | `http://your-vps-ip:8790/sub` | Main proxy list page |
| API IP | `http://your-vps-ip:8790/api/v1/myip` | Check your IP |
| Subscription | `http://your-vps-ip:8790/api/v1/sub?format=raw` | Get proxy list |
| Health Check | `http://your-vps-ip:8790/check?target=1.1.1.1:443` | Check proxy health |
| WebSocket | `ws://your-vps-ip:8790/<proxy-ip>-<port>` | Direct proxy tunnel |

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 8790
sudo lsof -i :8790

# Kill process
sudo kill -9 <PID>

# Or use different port in docker-compose
ports:
  - "8888:8790"  # External:Internal
```

### Container Not Starting
```bash
# Check container status
docker ps -a | grep vless-gateway

# Check logs for errors
docker logs vless-gateway

# Restart container
docker restart vless-gateway

# Recreate container
docker stop vless-gateway
docker rm vless-gateway
# Then redeploy from Portainer
```

### WebSocket Not Working
```bash
# Check if server is listening
docker exec vless-gateway netstat -tlpn

# Should show: 0.0.0.0:8790

# Check logs for WebSocket activity
docker logs vless-gateway | grep -i websocket

# Test from inside container
docker exec vless-gateway wget -O- http://localhost:8790/api/v1/myip
```

### Can't Access from External IP
```bash
# Check Docker port binding
docker inspect vless-gateway | grep -A 5 PortBindings

# Should show: "8790/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8790"}]

# Test from server
curl http://localhost:8790/sub

# Test from external (replace with your VPS IP)
curl http://YOUR_VPS_IP:8790/sub
```

## 📊 Health Check

```bash
# Check health status
docker inspect vless-gateway | grep -A 10 Health

# Manual health check
wget -O- http://localhost:8790/api/v1/myip

# Expected output: Your IP and request headers in JSON
```

## 🔄 Update Container

```bash
# Method 1: Via Portainer
# Go to Stacks → vless-gateway → Update the stack

# Method 2: Via CLI
docker-compose down
docker-compose pull
docker-compose up -d

# Method 3: Force rebuild
docker stop vless-gateway
docker rm vless-gateway
# Then redeploy from Portainer
```

## 🌐 Reverse Proxy with Nginx

If you want to use domain with SSL:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8790;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 💡 Tips

1. **Always check logs first** when troubleshooting
2. **Test locally** before exposing to internet
3. **Use health checks** to monitor container status
4. **Backup configurations** before making changes
5. **Update regularly** by pulling latest from GitHub

## 📝 Environment Variables

You can customize behavior by changing these in Portainer:

```yaml
environment:
  - PORT=8790                    # Change port (must match ports mapping)
  - APP_DOMAIN=your-domain.com   # Your domain/IP
  - PROXY_PER_PAGE=24           # Proxies per page
  - PORT_OPTIONS=443,80         # Ports to include in configs
  - PROTOCOL_OPTIONS=trojan,vless,ss  # Protocols to support
```

## 🆘 Still Not Working?

1. Check all logs: `docker logs vless-gateway > debug.log`
2. Verify port is open: `telnet your-vps-ip 8790`
3. Check firewall: `sudo ufw status`
4. Test locally first: `curl http://localhost:8790/sub`
5. Verify DNS resolution if using domain
6. Check proxy list URLs are accessible from VPS

## 📚 Documentation

- Full README: [README.md](./README.md)
- WebSocket Debug Guide: [WEBSOCKET-DEBUG.md](./WEBSOCKET-DEBUG.md)
- GitHub Repository: https://github.com/danprat/vless-vps-arm
