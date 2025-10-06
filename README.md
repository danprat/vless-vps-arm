# Self-hosted VLESS/Trojan/SS WebSocket Gateway

This project adapts the original Cloudflare Worker script into a standalone Node.js service that you can self-host on any ARM64 VPS (or other architectures) using Docker. The gateway accepts WebSocket connections, detects VLESS/Trojan/Shadowsocks handshakes, and forwards traffic to the requested upstream destination without relying on Cloudflare infrastructure.

## Features
- VLESS/Trojan/Shadowsocks over WebSocket with TCP and UDP forwarding
- Subscription API compatible with the original worker output (`/sub`, `/api/v1/sub`)
- Optional reverse proxy fallback when `REVERSE_PROXY_TARGET` is set
- Configurable proxy list sources via environment variables
- Works on ARM64 thanks to the multi-arch Node.js base image

## Prerequisites
- Docker 24+
- A VPS (ARM64 or x86_64)
- Portainer (recommended for easy deployment)

## Installation Methods

### Method 1: Portainer One-Click Deployment (Recommended)

**🚀 Copy & Paste Ready - Langsung Deploy!**

1. Buka Portainer → **Stacks** → **Add Stack**
2. Stack name: `vless-gateway`  
3. Copy-paste konfigurasi ini:

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
      - "8787:8787"
    environment:
      - PORT=8787
      - APP_DOMAIN=localhost
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
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8787/api/v1/myip"]
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

4. Ganti `APP_DOMAIN=localhost` dengan domain/IP VPS Anda
5. Klik **Deploy the stack** 
6. Akses: `http://your-vps-ip:8787/sub`

**✅ Selesai! Tidak perlu download atau setup tambahan.**

**📊 Monitor Status:**
- Health check akan otomatis cek status setiap 30 detik
- Logs dibatasi max 10MB per file untuk menghemat space
- Auto-restart jika container crash

### Method 2: Detailed Portainer Setup (Advanced)

#### Step 1: Install Portainer on your VPS

For **AMD64** systems:
```bash
docker volume create portainer_data
docker run -d -p 8000:8000 -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
```

For **ARM64** systems (like Raspberry Pi or ARM VPS):
```bash
docker volume create portainer_data
docker run -d -p 8000:8000 -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest --platform linux/arm64
```

#### Step 2: Access Portainer Web Interface
1. Open your browser and go to `https://your-vps-ip:9443`
2. Create an admin user account on first visit
3. Select "Docker" as your environment

#### Step 3: Deploy VLESS Gateway via Portainer (One-Click Setup)

1. In Portainer, go to **Stacks** → **Add Stack**
2. Name your stack: `vless-gateway`
3. Choose **Web editor** and paste this **complete configuration** (ready to use):

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
      - "8787:8787"
    environment:
      - PORT=8787
      - APP_DOMAIN=${APP_DOMAIN:-localhost}
      - ROOT_DOMAIN=
      - SERVICE_NAME=
      - PROXY_BANK_URL=https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt
      - KV_PROXY_URL=https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/kvProxyList.json
      - PORT_OPTIONS=443,80
      - PROTOCOL_OPTIONS=trojan,vless,ss
      - DNS_SERVER_ADDRESS=94.140.14.14
      - DNS_SERVER_PORT=53
      - PROXY_HEALTH_CHECK_API=https://id1.foolvpn.me/api/v1/check
      - CONVERTER_URL=https://api.foolvpn.me/convert
      - REVERSE_PROXY_TARGET=
      - DONATE_LINK=https://trakteer.id/dickymuliafiqri/tip
      - PROXY_PER_PAGE=24
    networks:
      - vless-network

networks:
  vless-network:
    driver: bridge
```

4. **Optional**: In **Environment variables** section di Portainer, tambahkan:
   - `APP_DOMAIN` = `your-domain.com` (atau IP VPS Anda)
5. Click **Deploy the stack**
6. Tunggu hingga build selesai (sekitar 2-3 menit)

> **💡 Tips**: Konfigurasi ini langsung menggunakan repository GitHub, jadi tidak perlu download atau clone manual!

#### Step 4: Verify Installation
1. Go to **Containers** in Portainer
2. Check that `vless-gateway` container is running (green status)
3. Click on the container name to view logs and ensure no errors
4. Test access: `http://your-vps-ip:8787/sub`

#### Step 5: Configure Reverse Proxy (Optional but Recommended)

For production use with SSL, add an Nginx reverse proxy:

1. Create another stack called `nginx-proxy`:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro  # Mount your SSL certificates here
    networks:
      - vless-network

networks:
  vless-network:
    external: true
```

2. Create `nginx.conf` configuration file in your project directory.

### Method 2: Quick Docker Command Line

If you prefer command line deployment:

```bash
# Clone the repository
git clone https://github.com/danprat/vless-vps-arm.git
cd vless-vps-arm

# Build the Docker image
docker build -t vless-gateway .

# Run the container
docker run -d \
  --name vless-gateway \
  --restart unless-stopped \
  -p 8787:8787 \
  -e APP_DOMAIN=your-domain.com \
  -e PORT=8787 \
  vless-gateway
```

The service listens on port `8787` by default. Access the web interface at `http://your-vps-ip:8787/sub`.

### Method 3: Docker Compose (Alternative)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  vless-gateway:
    build: .
    container_name: vless-gateway
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      - PORT=8787
      - APP_DOMAIN=your-domain.com
      # Add other environment variables as needed

networks:
  default:
    name: vless-network
```

Then run:
```bash
docker-compose up -d
```

## Environment variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Listener port |
| `APP_DOMAIN` | *(request Host header)* | Public domain used in generated configs (set when reverse proxying) |
| `ROOT_DOMAIN` | *(unused when `APP_DOMAIN` set)* | Optional root domain used with `SERVICE_NAME` to build fallback domain |
| `SERVICE_NAME` | *(unused when `APP_DOMAIN` set)* | Optional label used alongside `ROOT_DOMAIN` |
| `PROXY_BANK_URL` | GitHub URL | Text file containing comma-separated proxy list |
| `KV_PROXY_URL` | GitHub URL | JSON mapping country codes to proxy entries |
| `PORT_OPTIONS` | `443,80` | Ports included when generating configs |
| `PROTOCOL_OPTIONS` | `trojan,vless,ss` | Protocols exposed in subscription output |
| `DNS_SERVER_ADDRESS` | `94.140.14.14` | DNS server used for UDP proxying |
| `DNS_SERVER_PORT` | `53` | DNS port |
| `PROXY_HEALTH_CHECK_API` | `https://id1.foolvpn.me/api/v1/check` | External API for `/check` endpoint |
| `CONVERTER_URL` | `https://api.foolvpn.me/convert` | Converter service for Clash/SFA/BFR formats |
| `REVERSE_PROXY_TARGET` | *(empty)* | Optional HTTP reverse proxy fallback target |
| `DONATE_LINK` | `https://trakteer.id/dickymuliafiqri/tip` | Link displayed in HTML footer |

## Endpoints
- `GET /sub` – HTML page listing proxies (same layout as worker)
- `GET /sub/:page` – Paginated proxy view
- `GET /api/v1/sub` – Subscription API with filters (`cc`, `port`, `vpn`, `limit`, `format`)
- `GET /api/v1/myip` – Basic IP echo
- `GET /check?target=ip:port` – Health-check proxy via external API
- `WS /<ip>-<port>` – Direct proxy WebSocket tunnel

## Development notes
- Node.js 20+ provides the required Web APIs (fetch, Request, Response, crypto.subtle)
- WebSocket handling is powered by the `ws` package
- UDP forwarding uses the native `dgram` module

## Troubleshooting

### WebSocket Connection Issues

**WebSocket tidak terhubung / Connection Refused:**

1. **Check Container Logs:**
   ```bash
   # Via Docker CLI
   docker logs vless-gateway
   
   # Via Portainer: Containers → vless-gateway → Logs
   ```
   
   Cari pesan error seperti:
   - `[WebSocket] Upgrade request received` - Berarti upgrade berhasil diterima
   - `[WebSocket] Connection established` - Berarti koneksi berhasil
   - `Error` atau `failed` - Ada masalah yang perlu diperbaiki

2. **Pastikan Port Binding Benar:**
   ```bash
   # Check if port is listening
   netstat -tlpn | grep 8787
   
   # Or dengan Docker
   docker port vless-gateway
   ```
   
   Harus menunjukkan: `0.0.0.0:8787 -> 8787/tcp`

3. **Test WebSocket Connection:**
   ```bash
   # Test dengan curl
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
        http://localhost:8787/test-proxy
   
   # Harus return 101 Switching Protocols
   ```

4. **Check Firewall Rules:**
   ```bash
   # UFW (Ubuntu)
   sudo ufw allow 8787/tcp
   
   # Firewalld (CentOS/RHEL)
   sudo firewall-cmd --permanent --add-port=8787/tcp
   sudo firewall-cmd --reload
   ```

5. **Verify WebSocket URL Format:**
   Format yang benar untuk proxy:
   - `ws://your-domain:8787/proxy-ip-port` (contoh: `/1.2.3.4-443`)
   - `ws://your-domain:8787/ID,SG,US` (untuk KV proxy)

**WebSocket terhubung tapi tidak ada data:**

1. **Check Proxy Configuration:**
   - Pastikan `proxyIP` variable ter-set dengan benar
   - Cek logs untuk `[WebSocket] Using direct proxy:` atau `[WebSocket] Selected proxy:`

2. **Verify Remote Proxy Accessible:**
   ```bash
   # Test connectivity ke proxy
   telnet proxy-ip proxy-port
   nc -zv proxy-ip proxy-port
   ```

3. **Check DNS Resolution:**
   ```bash
   # Test DNS server
   dig @94.140.14.14 google.com
   ```

**WebSocket disconnects immediately:**

1. **Check Protocol Detection:**
   - Logs harus menunjukkan protocol type: `VLESS`, `Trojan`, atau `Shadowsocks`
   - Jika `Unknown protocol` - client configuration mungkin salah

2. **Verify Client Configuration:**
   - UUID harus valid format
   - Path harus sesuai dengan format: `/<proxy-ip>-<proxy-port>`
   - Security/TLS settings harus sesuai dengan port (443=TLS, 80=NTLS)

### Portainer Issues

**Cannot access Portainer web interface:**
- Ensure ports 8000 and 9443 are open in your firewall
- Check if Portainer container is running: `docker ps | grep portainer`
- For ARM64 systems, ensure you're using the correct image

**Container fails to start:**
- Check container logs in Portainer: Go to Containers → Click container name → Logs
- Verify all environment variables are set correctly
- Ensure port 8787 is not already in use: `netstat -tlpn | grep 8787`

**Build fails in Portainer:**
- Make sure your VPS has sufficient disk space
- Try pulling the base image manually: `docker pull node:20-alpine`
- Check if the GitHub repository is accessible from your VPS

**Cannot access the VLESS gateway:**
- Verify the container is running in Portainer
- Check firewall rules allow traffic on port 8787
- Test locally first: `curl http://localhost:8787/sub`

### General Issues

**WebSocket connection failures:**
- Ensure proper reverse proxy configuration if using SSL
- Check that WebSocket upgrade headers are properly forwarded
- Verify no firewall is blocking WebSocket connections

**Performance issues:**
- Monitor container resource usage in Portainer
- Consider increasing container memory limits
- Check proxy list sources are accessible

## Security considerations
- The gateway forwards raw traffic to destinations requested by clients. Protect it behind authentication, firewall rules, or dedicated upstream lists as needed.
- When exposing externally, place it behind TLS termination (e.g., Nginx/Traefik) to secure WebSocket upgrades.
- Change default Portainer admin password immediately after installation
- Consider using Docker secrets for sensitive environment variables in production

## Production Deployment Tips

### Using Traefik with Portainer
For automatic SSL certificates and better routing:

1. Deploy Traefik stack in Portainer
2. Add labels to your VLESS gateway service:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.vless.rule=Host(`your-domain.com`)"
  - "traefik.http.routers.vless.entrypoints=websecure"
  - "traefik.http.routers.vless.tls.certresolver=letsencrypt"
```

### Monitoring with Portainer
- Use Portainer's container stats to monitor performance
- Set up container health checks for automatic restarts
- Enable logging drivers for centralized log management

## License
MIT (aligns with upstream worker usage).
