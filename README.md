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

## Quick start
```bash
docker build -t vless-gateway .
docker run -d \
  --name vless-gateway \
  -p 8787:8787 \
  -e APP_DOMAIN=proxy.example.com \
  vless-gateway
```

The service listens on port `8787` by default. Adjust environment variables to match your desired hostnames and proxy sources.

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

## Security considerations
- The gateway forwards raw traffic to destinations requested by clients. Protect it behind authentication, firewall rules, or dedicated upstream lists as needed.
- When exposing externally, place it behind TLS termination (e.g., Nginx/Traefik) to secure WebSocket upgrades.

## License
MIT (aligns with upstream worker usage).
