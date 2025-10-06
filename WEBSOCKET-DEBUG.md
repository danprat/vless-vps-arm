# WebSocket Debugging Guide

## Quick Check Commands

### 1. Check Container Status
```bash
# Via Docker
docker ps | grep vless-gateway
docker logs -f vless-gateway

# Via Portainer
# Go to: Containers → vless-gateway → Logs
```

### 2. Test Server Accessibility
```bash
# Test HTTP endpoint
curl http://localhost:8790/api/v1/myip

# Should return your IP and request headers
```

### 3. Test WebSocket Upgrade
```bash
# Test WebSocket handshake
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  http://localhost:8790/1.1.1.1-443

# Expected response: HTTP/1.1 101 Switching Protocols
```

### 4. Check Port Binding
```bash
# Linux
netstat -tlpn | grep 8790
ss -tlpn | grep 8790

# macOS
lsof -i :8790

# Docker
docker port vless-gateway
```

### 5. Check Logs for WebSocket Activity
```bash
docker logs vless-gateway 2>&1 | grep WebSocket

# You should see:
# [WebSocket] Upgrade request received: /path
# [WebSocket] Connection established
# [WebSocket Handler] New connection from x.x.x.x
```

## Common Issues & Solutions

### Issue 1: Port Already in Use
```bash
# Error: EADDRINUSE
# Solution: Kill the process using the port
sudo lsof -ti:8790 | xargs kill -9

# Or change port in docker-compose:
ports:
  - "8888:8790"  # Use different external port
```

### Issue 2: Container Starts but WebSocket Fails
```bash
# Check if server is binding to correct interface
docker exec vless-gateway netstat -tlpn

# Should show: 0.0.0.0:8790 (not 127.0.0.1:8790)
```

### Issue 3: Connection Refused from External IP
```bash
# Check firewall
sudo ufw status
sudo ufw allow 8790/tcp

# Check Docker network
docker network inspect vless-network
```

### Issue 4: WebSocket Connects but No Data
```bash
# Check proxy configuration in logs
docker logs vless-gateway | grep "Using.*proxy"

# Test proxy connectivity from container
docker exec vless-gateway nc -zv proxy-ip proxy-port
```

## Log Messages Explained

### Success Messages
```
✅ [WebSocket] Upgrade request received: /1.1.1.1-443
   → Server received upgrade request

✅ [WebSocket] Using direct proxy: 1.1.1.1-443
   → Proxy configuration parsed correctly

✅ [WebSocket] Completing upgrade...
   → Server is upgrading to WebSocket

✅ [WebSocket] Connection established
   → WebSocket connection successful

✅ [WebSocket Handler] New connection from x.x.x.x
   → Client connected successfully
```

### Error Messages
```
❌ [WebSocket] Invalid upgrade header, destroying socket
   → Fix: Check client sends proper WebSocket headers

❌ [WebSocket] No proxies found for key: XX
   → Fix: Check KV_PROXY_URL is accessible

❌ [WebSocket Handler] Error processing message
   → Fix: Check protocol (VLESS/Trojan/SS) configuration

❌ protocol parsing failed
   → Fix: Verify client protocol matches server config
```

## Testing with Different Clients

### Test with wscat (Node.js tool)
```bash
npm install -g wscat

# Test connection
wscat -c ws://localhost:8790/1.1.1.1-443

# With protocol header
wscat -c ws://localhost:8790/1.1.1.1-443 \
  --header "Sec-WebSocket-Protocol: base64-encoded-data"
```

### Test with websocat (Rust tool)
```bash
# Install
brew install websocat  # macOS
apt install websocat   # Ubuntu

# Test
websocat ws://localhost:8790/1.1.1.1-443
```

### Test with Python
```python
import websocket

ws = websocket.WebSocket()
ws.connect("ws://localhost:8790/1.1.1.1-443")
print("Connected!")
ws.close()
```

## Performance Testing

### Connection Load Test
```bash
# Install Apache Bench
apt install apache2-utils

# Test concurrent connections (adjust for WebSocket load testing)
ab -n 1000 -c 10 http://localhost:8790/sub
```

### Monitor Container Resources
```bash
# Real-time stats
docker stats vless-gateway

# Via Portainer: Containers → vless-gateway → Stats
```

## Environment Variables for Debugging

Add these to docker-compose for more verbose logging:

```yaml
environment:
  - NODE_ENV=development
  - DEBUG=*  # Enable all debug output
  - NODE_OPTIONS=--trace-warnings  # Show deprecation warnings
```

## Network Troubleshooting

### DNS Issues
```bash
# Test DNS from container
docker exec vless-gateway nslookup google.com 94.140.14.14

# Test with dig
docker exec vless-gateway dig @94.140.14.14 google.com
```

### Proxy Connectivity
```bash
# Test if proxy is reachable
docker exec vless-gateway nc -zv proxy-ip proxy-port

# With timeout
docker exec vless-gateway timeout 5 nc -zv proxy-ip proxy-port
```

### Check Container Network
```bash
# List container networks
docker inspect vless-gateway | grep -A 10 Networks

# Test internal connectivity
docker exec vless-gateway ping -c 3 8.8.8.8
```

## Health Check Status

```bash
# Check health status
docker inspect vless-gateway | grep -A 10 Health

# View health check logs
docker inspect vless-gateway | jq '.[0].State.Health'
```

Expected output:
```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [...]
}
```

## Quick Fix Checklist

- [ ] Container is running (`docker ps`)
- [ ] Port 8790 is accessible (`netstat -tlpn`)
- [ ] Server binds to 0.0.0.0 (not 127.0.0.1)
- [ ] Firewall allows port 8790
- [ ] Logs show "Server listening on 0.0.0.0:8790"
- [ ] Health check returns "healthy"
- [ ] Can access http://localhost:8790/sub
- [ ] WebSocket upgrade returns 101 status
- [ ] No error messages in logs

## Support

If issues persist:
1. Collect logs: `docker logs vless-gateway > debug.log`
2. Check environment: `docker inspect vless-gateway > container-info.json`
3. Test locally first before exposing externally
4. Verify proxy list URLs are accessible
