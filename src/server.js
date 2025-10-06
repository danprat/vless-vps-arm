import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dgram from 'node:dgram';
import { TextDecoder, TextEncoder } from 'node:util';
import { pipeline } from 'node:stream';
import { finished } from 'node:stream/promises';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const webcrypto = crypto.webcrypto;
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (input) => Buffer.from(input, 'binary').toString('base64');
}
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (input) => Buffer.from(input, 'base64').toString('binary');
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const configuredRootDomain = process.env.ROOT_DOMAIN;
const configuredServiceName = process.env.SERVICE_NAME;
const configuredAppDomain = process.env.APP_DOMAIN;
const kvProxyUrl =
  process.env.KV_PROXY_URL ||
  'https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/kvProxyList.json';
const proxyBankUrl =
  process.env.PROXY_BANK_URL ||
  'https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt';
const dnsServerAddress = process.env.DNS_SERVER_ADDRESS || '94.140.14.14';
const dnsServerPort = Number(process.env.DNS_SERVER_PORT || 53);
const proxyHealthCheckApi = process.env.PROXY_HEALTH_CHECK_API || 'https://id1.foolvpn.me/api/v1/check';
const converterUrl = process.env.CONVERTER_URL || 'https://api.foolvpn.me/convert';
const donateLink = process.env.DONATE_LINK || 'https://trakteer.id/dickymuliafiqri/tip';
const proxyPerPage = Number(process.env.PROXY_PER_PAGE || 24);
const portOptions = (process.env.PORT_OPTIONS || '443,80')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean);
const protocolOptions = (process.env.PROTOCOL_OPTIONS || 'trojan,vless,ss')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const reverseProxyTarget = process.env.REVERSE_PROXY_TARGET || '';
const listenPort = Number(process.env.PORT || 8787);

function extractHost(headerValue) {
  return (headerValue || '').split(':')[0] || 'localhost';
}

function getServiceLabel(hostHeader) {
  return configuredServiceName || extractHost(hostHeader);
}

function getAppDomain(hostHeader) {
  if (configuredAppDomain) return configuredAppDomain;
  if (configuredRootDomain && configuredServiceName) {
    return `${configuredServiceName}.${configuredRootDomain}`;
  }
  return extractHost(hostHeader);
}

let proxyIP = '';
let cachedProxyList = [];

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
const CORS_HEADER_OPTIONS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function getKVProxyList(kvUrl = kvProxyUrl) {
  if (!kvUrl) {
    throw new Error('No KV Proxy URL Provided!');
  }

  const kvProxy = await fetch(kvUrl);
  if (kvProxy.ok) {
    return kvProxy.json();
  }
  return {};
}

async function getProxyList(bankUrl = proxyBankUrl) {
  if (!bankUrl) {
    throw new Error('No Proxy Bank URL Provided!');
  }

  const proxyBank = await fetch(bankUrl);
  if (proxyBank.ok) {
    const text = (await proxyBank.text()) || '';
    const proxyString = text.split('\n').filter(Boolean);
    cachedProxyList = proxyString
      .map((entry) => {
        const [ip, port, country, org] = entry.split(',');
        return {
          proxyIP: ip || 'Unknown',
          proxyPort: port || 'Unknown',
          country: country || 'Unknown',
          org: org || 'Unknown Org',
        };
      })
      .filter(Boolean);
  }

  return cachedProxyList;
}

function httpError(res, status, message, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(message);
}

function bufferFromArrayBuffer(arrayBuffer) {
  return Buffer.from(arrayBuffer);
}

function arrayBufferFromBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function reverse(str) {
  return str.split('').reverse().join('');
}

function getFlagEmoji(isoCode) {
  return String.fromCodePoint(
    ...(isoCode || '')
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0))
  );
}

function arrayBufferToHex(bufferLike) {
  const buffer = bufferLike instanceof ArrayBuffer ? new Uint8Array(bufferLike) : new Uint8Array(bufferLike.buffer || bufferLike);
  return [...buffer].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) {
    return { error: null };
  }
  try {
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    const decode = Buffer.from(base64Str, 'base64');
    return { earlyData: arrayBufferFromBuffer(decode), error: null };
  } catch (error) {
    return { error };
  }
}

function shuffleArray(array) {
  let currentIndex = array.length;
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
}

function generateHashFromText(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function buildResponse(res, body, { status = 200, headers = {} } = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function negotiateContentType(pathname) {
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/html; charset=utf-8';
}

class Document {
  constructor(request, serviceLabel) {
    this.request = request;
    this.html = baseHTML;
    this.url = new URL(request.url, `http://${request.headers.host}`);
    this.proxies = [];
    this.serviceLabel = serviceLabel;
  }

  setTitle(title) {
    this.html = this.html.replaceAll('PLACEHOLDER_JUDUL', title);
  }

  addInfo(text) {
    const rendered = `<span>${text}</span>`;
    this.html = this.html.replaceAll('PLACEHOLDER_INFO', `${rendered}\nPLACEHOLDER_INFO`);
  }

  registerProxies(data, proxies) {
    this.proxies.push({ ...data, list: proxies });
  }

  buildProxyGroup() {
    let proxyGroupElement = "";
    proxyGroupElement += `<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">`;
    for (let i = 0; i < this.proxies.length; i++) {
      const proxyData = this.proxies[i];
      proxyGroupElement += `<div class="lozad scale-95 mb-2 bg-white dark:bg-neutral-800 transition-transform duration-200 rounded-lg p-4 w-60 border-2 border-neutral-800">`;
      proxyGroupElement += `  <div id="countryFlag" class="absolute -translate-y-9 -translate-x-2 border-2 border-neutral-800 rounded-full overflow-hidden"><img width="32" src="https://hatscripts.github.io/circle-flags/flags/${proxyData.country.toLowerCase()}.svg" /></div>`;
      proxyGroupElement += `  <div>`;
      proxyGroupElement += `    <div id="ping-${i}" class="animate-pulse text-xs font-semibold dark:text-white">Idle ${proxyData.proxyIP}:${proxyData.proxyPort}</div>`;
      proxyGroupElement += `  </div>`;
      proxyGroupElement += `  <div class="rounded py-1 px-2 bg-amber-400 dark:bg-neutral-800 dark:border-2 dark:border-amber-400">`;
      proxyGroupElement += `    <h5 class="font-bold text-md text-neutral-900 dark:text-white mb-1 overflow-x-scroll scrollbar-hide text-nowrap">${proxyData.org}</h5>`;
      proxyGroupElement += `    <div class="text-neutral-900 dark:text-white text-sm">`;
      proxyGroupElement += `      <p>IP: ${proxyData.proxyIP}</p>`;
      proxyGroupElement += `      <p>Port: ${proxyData.proxyPort}</p>`;
      proxyGroupElement += `      <div id="container-region-check-${i}">`;
      proxyGroupElement += `        <input id="config-sample-${i}" class="hidden" type="text" value="${proxyData.list[0] || ''}">`;
      proxyGroupElement += `      </div>`;
      proxyGroupElement += `    </div>`;
      proxyGroupElement += `  </div>`;
      proxyGroupElement += `  <div class="flex flex-col gap-2 mt-3 text-sm">`;
      const indexName = [
        `${reverse('NAJORT')} TLS`,
        `${reverse('SSELV')} TLS`,
        `${reverse('SS')} TLS`,
        `${reverse('NAJORT')} NTLS`,
        `${reverse('SSELV')} NTLS`,
        `${reverse('SS')} NTLS`,
      ];
      for (let x = 0; x < proxyData.list.length && x < indexName.length; x++) {
        if (x % 2 === 0) {
          proxyGroupElement += `<div class="flex gap-2 justify-around w-full">`;
        }
        const label = indexName[x] || `Conf ${x + 1}`;
        proxyGroupElement += `<button class="bg-blue-500 dark:bg-neutral-800 dark:border-2 dark:border-blue-500 rounded p-1 w-full text-white" onclick="copyToClipboard('${proxyData.list[x]}')">${label}</button>`;
        if (x % 2 === 1) {
          proxyGroupElement += `</div>`;
        }
      }
      proxyGroupElement += `  </div>`;
      proxyGroupElement += `</div>`;
    }
    proxyGroupElement += `</div>`;

    this.html = this.html.replaceAll('PLACEHOLDER_PROXY_GROUP', `${proxyGroupElement}`);
  }

  buildCountryFlag() {
    const proxyListUrl = this.url.searchParams.get('proxy-list');
    const flagList = cachedProxyList.map((proxy) => proxy.country);
    const uniqueFlags = new Set(flagList);
    let flagElement = '';
    uniqueFlags.forEach((flag) => {
      flagElement += `<a href="/sub?cc=${flag}${proxyListUrl ? '&proxy-list=' + proxyListUrl : ''}" class="py-1"><img width=20 src="https://hatscripts.github.io/circle-flags/flags/${flag.toLowerCase()}.svg" /></a>`;
    });
    this.html = this.html.replaceAll('PLACEHOLDER_BENDERA_NEGARA', flagElement);
  }

  addPageButton(text, link, isDisabled) {
    const button = `<li><button ${isDisabled ? 'disabled' : ''} class="px-3 py-1 bg-amber-400 border-2 border-neutral-800 rounded" onclick=navigateTo('${link}')>${text}</button></li>`;
    this.html = this.html.replaceAll('PLACEHOLDER_PAGE_BUTTON', `${button}\nPLACEHOLDER_PAGE_BUTTON`);
  }

  build() {
    this.buildProxyGroup();
    this.buildCountryFlag();
    this.html = this.html.replaceAll('PLACEHOLDER_API_READY', 'hidden');
    return this.html.replaceAll(/PLACEHOLDER_\w+/gim, '');
  }
}

const baseHTML = `
<!DOCTYPE html>
<html lang="en" id="html" class="scroll-auto scrollbar-hide dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Proxy List</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    </style>
  </head>
  <body class="font-sans antialiased min-h-screen bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200">
    <div class="min-h-screen" id="container-main">
      <header class="bg-white/70 shadow-md backdrop-blur border-b border-white/40 sticky top-0 z-10">
        <div class="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-semibold text-indigo-700" id="judul">PLACEHOLDER_JUDUL</h1>
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2 text-sm">PLACEHOLDER_INFO</div>
            <nav class="flex items-center space-x-2">PLACEHOLDER_BENDERA_NEGARA</nav>
          </div>
        </div>
      </header>
      <main class="max-w-5xl mx-auto px-6 py-8">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" id="container-proxy">
          PLACEHOLDER_PROXY_GROUP
        </div>
        <div class="mt-8 flex justify-center">
          <ul class="flex space-x-3" id="container-pagination">
            PLACEHOLDER_PAGE_BUTTON
          </ul>
        </div>
      </main>
    </div>
    <footer>
      <div class="fixed bottom-3 right-3 flex flex-col gap-1 z-50">
        <a href="${donateLink}" target="_blank">
          <button class="bg-green-500 rounded-full border-2 border-neutral-800 p-1 block">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" />
              <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V6Z" clip-rule="evenodd" />
            </svg>
          </button>
        </a>
      </div>
    </footer>
    <script>
      async function copyToClipboard(value) {
        await navigator.clipboard.writeText(value);
      }
      function navigateTo(path) {
        window.location.href = path;
      }
    </script>
  </body>
</html>
`;

async function getAllConfig(request, hostName, proxyList, page = 0, serviceLabel = extractHost(hostName)) {
  const startIndex = proxyPerPage * page;
  try {
    const uuid = crypto.randomUUID();
    const uri = new URL(`${reverse('najort')}://${hostName}`);
    uri.searchParams.set('encryption', 'none');
    uri.searchParams.set('type', 'ws');
    uri.searchParams.set('host', hostName);

    const document = new Document(request, serviceLabel);
    document.setTitle("Welcome to <span class='text-blue-500 font-semibold'>Nautica</span>");
    document.addInfo(`Total: ${proxyList.length}`);
    document.addInfo(`Page: ${page}/${Math.floor(proxyList.length / proxyPerPage)}`);

    for (let i = startIndex; i < startIndex + proxyPerPage; i++) {
      const proxy = proxyList[i];
      if (!proxy) break;
      const { proxyIP, proxyPort, country, org } = proxy;
      uri.searchParams.set('path', `/${proxyIP}-${proxyPort}`);

      const proxies = [];
      for (const port of portOptions) {
        uri.port = port.toString();
        uri.hash = `${i + 1} ${getFlagEmoji(country)} ${org} WS ${port === 443 ? 'TLS' : 'NTLS'} [${serviceLabel}]`;
        for (const protocol of protocolOptions) {
          if (protocol === 'ss') {
            uri.username = btoa(`none:${uuid}`);
            uri.searchParams.set(
              'plugin',
              `v2ray-plugin${port === 80 ? '' : ';tls'};mux=0;mode=websocket;path=/${proxyIP}-${proxyPort};host=${hostName}`
            );
          } else {
            uri.username = uuid;
            uri.searchParams.delete('plugin');
          }
          uri.protocol = protocol;
          uri.searchParams.set('security', port === 443 ? 'tls' : 'none');
          uri.searchParams.set('sni', port === 80 && protocol === 'vless' ? '' : hostName);
          proxies.push(uri.toString());
        }
      }

      document.registerProxies({ proxyIP, proxyPort, country, org }, proxies);
    }
    document.addPageButton('Prev', `/sub/${page > 0 ? page - 1 : 0}`, page <= 0);
    document.addPageButton('Next', `/sub/${page + 1}`, page >= Math.floor(proxyList.length / proxyPerPage));
    return document.build();
  } catch (error) {
    return `An error occurred while generating the ${reverse('SSELV')} configurations. ${error}`;
  }
}

function protocolSniffer(buffer) {
  if (buffer.byteLength >= 62) {
    const najortDelimiter = buffer.slice(56, 60);
    if (najortDelimiter[0] === 0x0d && najortDelimiter[1] === 0x0a) {
      if (najortDelimiter[2] === 0x01 || najortDelimiter[2] === 0x03 || najortDelimiter[2] === 0x7f) {
        if (najortDelimiter[3] === 0x01 || najortDelimiter[3] === 0x03 || najortDelimiter[3] === 0x04) {
          return reverse('najorT');
        }
      }
    }
  }
  const sselvDelimiter = buffer.slice(1, 17);
  const delimiterHex = arrayBufferToHex(arrayBufferFromBuffer(sselvDelimiter));
  if (delimiterHex.match(/^[0-9a-f]{8}[0-9a-f]{4}4[0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i)) {
    return reverse('SSELV');
  }
  return reverse('skcoswodahS');
}

function parseNajortHeader(buffer) {
  const socks5DataBuffer = buffer.slice(58);
  if (socks5DataBuffer.byteLength < 6) {
    return {
      hasError: true,
      message: 'invalid SOCKS5 request data',
    };
  }
  let isUDP = false;
  const cmd = socks5DataBuffer[0];
  if (cmd === 3) {
    isUDP = true;
  } else if (cmd !== 1) {
    return { hasError: true, message: 'Unsupported command type!' };
  }
  const addressType = socks5DataBuffer[1];
  let addressLength = 0;
  let addressValueIndex = 2;
  let addressValue = '';
  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = Array.from(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
      break;
    case 3:
      addressLength = socks5DataBuffer[addressValueIndex];
      addressValueIndex += 1;
      addressValue = textDecoder.decode(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 4:
      addressLength = 16;
      addressValue = Array.from(new Uint16Array(arrayBufferFromBuffer(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + addressLength)))).map((value) => value.toString(16)).join(':');
      break;
    default:
      return {
        hasError: true,
        message: `invalid addressType is ${addressType}`,
      };
  }
  if (!addressValue) {
    return {
      hasError: true,
      message: `address is empty, addressType is ${addressType}`,
    };
  }
  const portIndex = addressValueIndex + addressLength;
  const portRemote = (socks5DataBuffer[portIndex] << 8) + socks5DataBuffer[portIndex + 1];
  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: portIndex + 4,
    rawClientData: socks5DataBuffer.slice(portIndex + 4),
    version: null,
    isUDP,
  };
}

function parseSsHeader(ssBuffer) {
  const addressType = ssBuffer[0];
  let addressLength = 0;
  let addressValueIndex = 1;
  let addressValue = '';
  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = Array.from(ssBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
      break;
    case 3:
      addressLength = ssBuffer[addressValueIndex];
      addressValueIndex += 1;
      addressValue = textDecoder.decode(ssBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 4: {
      addressLength = 16;
      const dataView = new DataView(arrayBufferFromBuffer(ssBuffer.slice(addressValueIndex, addressValueIndex + addressLength)));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(':');
      break;
    }
    default:
      return {
        hasError: true,
        message: `Invalid addressType for ${reverse('skcoswodahS')}: ${addressType}`,
      };
  }
  if (!addressValue) {
    return {
      hasError: true,
      message: `Destination address empty, address type is: ${addressType}`,
    };
  }
  const portIndex = addressValueIndex + addressLength;
  const portRemote = (ssBuffer[portIndex] << 8) + ssBuffer[portIndex + 1];
  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex: portIndex + 2,
    rawClientData: ssBuffer.slice(portIndex + 2),
    version: null,
    isUDP: portRemote === 53,
  };
}

function parseSselvHeader(buffer) {
  const version = buffer[0];
  let isUDP = false;
  const optLength = buffer[17];
  const cmd = buffer[18 + optLength];
  if (cmd === 2) {
    isUDP = true;
  } else if (cmd !== 1) {
    return {
      hasError: true,
      message: `command ${cmd} is not support, command 01-tcp,02-udp,03-mux`,
    };
  }
  const portIndex = 18 + optLength + 1;
  const portRemote = (buffer[portIndex] << 8) + buffer[portIndex + 1];
  let addressIndex = portIndex + 2;
  const addressType = buffer[addressIndex];
  let addressLength = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue = '';
  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = Array.from(buffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
      break;
    case 2:
      addressLength = buffer[addressValueIndex];
      addressValueIndex += 1;
      addressValue = textDecoder.decode(buffer.slice(addressValueIndex, addressValueIndex + addressLength));
      break;
    case 3: {
      addressLength = 16;
      const dataView = new DataView(arrayBufferFromBuffer(buffer.slice(addressValueIndex, addressValueIndex + addressLength)));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(':');
      break;
    }
    default:
      return {
        hasError: true,
        message: `invild  addressType is ${addressType}`,
      };
  }
  if (!addressValue) {
    return {
      hasError: true,
      message: `addressValue is empty, addressType is ${addressType}`,
    };
  }
  addressIndex = addressValueIndex + addressLength;
  const rawDataIndex = addressIndex + 2;
  const rawClientData = buffer.slice(rawDataIndex);
  return {
    hasError: false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex,
    rawClientData,
    version,
    isUDP,
  };
}

function safeCloseWebSocket(ws) {
  if (!ws) return;
  try {
    if (ws.readyState === WS_READY_STATE_OPEN || ws.readyState === WS_READY_STATE_CLOSING) {
      ws.close();
    }
  } catch (error) {
    console.error('safeCloseWebSocket error', error);
  }
}

function remoteSocketToWS(remoteSocket, ws, responseHeader, retry, log) {
  let header = responseHeader;
  let hasIncomingData = false;
  remoteSocket.on('data', (chunk) => {
    hasIncomingData = true;
    if (ws.readyState !== WS_READY_STATE_OPEN) {
      remoteSocket.destroy();
      return;
    }
    if (header) {
      ws.send(Buffer.concat([header, chunk]));
      header = null;
    } else {
      ws.send(chunk);
    }
  });
  remoteSocket.on('end', () => {
    log(`remoteConnection.readable is close with hasIncomingData is ${hasIncomingData}`);
    safeCloseWebSocket(ws);
  });
  remoteSocket.on('error', (error) => {
    console.error('remoteSocket error', error);
    safeCloseWebSocket(ws);
  });
  remoteSocket.on('close', () => {
    if (!hasIncomingData && typeof retry === 'function') {
      log('retry');
      retry();
    }
  });
}

function handleTCPOutbound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, ws, responseHeader, log) {
  function connectAndWrite(address, port) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: address, port }, () => {
        remoteSocketWrapper.socket = socket;
        log(`connected to ${address}:${port}`);
        if (rawClientData && rawClientData.length) {
          socket.write(rawClientData);
        }
        resolve(socket);
      });
      socket.on('error', (error) => {
        log(`tcp socket error ${error.message}`);
        reject(error);
      });
      socket.on('close', () => {
        safeCloseWebSocket(ws);
      });
    });
  }

  const retry = async () => {
    try {
      const [fallbackAddress, fallbackPort] = (proxyIP || '').split(/[:=-]/);
      const address = fallbackAddress || addressRemote;
      const port = fallbackPort ? Number(fallbackPort) : portRemote;
      const socket = await connectAndWrite(address, port);
      remoteSocketToWS(socket, ws, responseHeader, null, log);
    } catch (error) {
      log(`retry tcpSocket failed ${error.message}`);
    }
  };

  connectAndWrite(addressRemote, portRemote)
    .then((socket) => {
      remoteSocketToWS(socket, ws, responseHeader, retry, log);
    })
    .catch((error) => {
      log(`initial connect failed ${error.message}`);
      retry();
    });
}

function handleUDPOutbound(targetAddress, targetPort, udpChunk, ws, responseHeader, log) {
  const udpType = net.isIP(targetAddress) === 6 ? 'udp6' : 'udp4';
  const socket = dgram.createSocket(udpType);
  let header = responseHeader;
  socket.on('message', (msg) => {
    if (ws.readyState === WS_READY_STATE_OPEN) {
      if (header) {
        ws.send(Buffer.concat([header, msg]));
        header = null;
      } else {
        ws.send(msg);
      }
    }
  });
  socket.on('error', (error) => {
    log(`UDP connection error ${error.message}`);
    socket.close();
    safeCloseWebSocket(ws);
  });
  socket.send(udpChunk, targetPort, targetAddress, (error) => {
    if (error) {
      log(`UDP send error ${error.message}`);
      socket.close();
      safeCloseWebSocket(ws);
    } else {
      log(`UDP chunk sent to ${targetAddress}:${targetPort}`);
    }
  });
  return socket;
}

async function checkProxyHealth(proxyHost, proxyPort) {
  const res = await fetch(`${proxyHealthCheckApi}?ip=${proxyHost}:${proxyPort}`);
  if (!res.ok) {
    throw new Error(`Failed to check proxy: ${res.status}`);
  }
  return res.json();
}

function parseProxyPath(pathname) {
  const proxyMatch = pathname.match(/^\/(.+[:=-]\d+)$/);
  return proxyMatch ? proxyMatch[1] : '';
}

function logFactory(addressLogRef, portLogRef) {
  return (info, event) => {
    console.log(`[${addressLogRef.value}:${portLogRef.value}] ${info}`, event || '');
  };
}

function websocketHandler(ws, request) {
  ws.binaryType = 'arraybuffer';
  let addressLog = { value: '' };
  let portLog = { value: '' };
  const log = logFactory(addressLog, portLog);
  const earlyDataHeader = request.headers['sec-websocket-protocol'] || '';
  const remoteSocketWrapper = { socket: null };
  let responseHeader = null;
  let isDNS = false;
  let udpSocket = null;

  const { earlyData, error: earlyDataError } = base64ToArrayBuffer(earlyDataHeader);
  if (earlyDataError) {
    console.error('early data error', earlyDataError);
  }

  async function processChunk(chunk) {
    if (!(chunk instanceof Buffer)) {
      chunk = Buffer.from(chunk);
    }
    if (isDNS) {
      if (udpSocket) {
        udpSocket.send(chunk);
      } else {
        udpSocket = handleUDPOutbound(dnsServerAddress, dnsServerPort, chunk, ws, responseHeader, log);
      }
      return;
    }
    if (remoteSocketWrapper.socket) {
      remoteSocketWrapper.socket.write(chunk);
      return;
    }
    const protocol = protocolSniffer(chunk);
    let protocolHeader;
    try {
      if (protocol === reverse('najorT')) {
        protocolHeader = parseNajortHeader(chunk);
      } else if (protocol === reverse('SSELV')) {
        protocolHeader = parseSselvHeader(chunk);
      } else if (protocol === reverse('skcoswodahS')) {
        protocolHeader = parseSsHeader(chunk);
      } else {
        throw new Error(`Unknown protocol ${protocol}`);
      }
    } catch (error) {
      log(`protocol parsing failed ${error.message}`);
      safeCloseWebSocket(ws);
      return;
    }
    if (protocolHeader.hasError) {
      log(protocolHeader.message);
      safeCloseWebSocket(ws);
      return;
    }
    if (protocolHeader.addressType === 1 || protocolHeader.addressType === 4) {
      addressLog.value = protocolHeader.addressRemote;
    } else {
      addressLog.value = protocolHeader.addressRemote;
    }
    portLog.value = protocolHeader.portRemote;

    let remotePort = protocolHeader.portRemote;
    let remoteAddress = protocolHeader.addressRemote;
    let rawClientData = protocolHeader.rawClientData;
    responseHeader = null;

    if (protocol === reverse('SSELV')) {
      responseHeader = Buffer.from([protocolHeader.version, 0]);
    } else if (protocol === reverse('najorT')) {
      responseHeader = Buffer.from('01', 'hex');
      rawClientData = chunk.slice(protocolHeader.rawDataIndex);
    } else if (protocol === reverse('skcoswodahS')) {
      const response = Buffer.from([0, 0, 0, protocolHeader.addressType]);
      responseHeader = Buffer.concat([response, chunk.slice(protocolHeader.rawDataIndex - 4, protocolHeader.rawDataIndex)]);
      rawClientData = chunk.slice(protocolHeader.rawDataIndex);
    }

    if (protocolHeader.isUDP) {
      isDNS = true;
      udpSocket = handleUDPOutbound(remoteAddress, remotePort || dnsServerPort, rawClientData, ws, responseHeader, log);
      return;
    }

    handleTCPOutbound(remoteSocketWrapper, remoteAddress, remotePort, rawClientData, ws, responseHeader, log);
  }

  ws.on('message', async (data) => {
    if (data instanceof ArrayBuffer) {
      await processChunk(Buffer.from(data));
    } else if (Array.isArray(data)) {
      await processChunk(Buffer.concat(data));
    } else {
      await processChunk(data);
    }
  });

  ws.on('close', () => {
    remoteSocketWrapper.socket?.destroy();
    udpSocket?.close();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error', err);
    remoteSocketWrapper.socket?.destroy();
    udpSocket?.close();
  });

  if (earlyData) {
    processChunk(Buffer.from(earlyData));
  }
}

async function reverseProxy(req, res, target, targetPath) {
  const targetUrl = new URL(req.url, `https://${target}`);
  if (targetPath) {
    targetUrl.pathname = targetPath;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  }
  headers.set('X-Forwarded-Host', req.headers.host || '');
  const init = {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    redirect: 'manual',
  };
  const response = await fetch(targetUrl, init);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body) {
    pipeline(response.body, res, (err) => {
      if (err) {
        console.error('Reverse proxy pipeline error', err);
      }
    });
  } else {
    res.end();
  }
}

async function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    buildResponse(res, '', { status: 204, headers: { ...CORS_HEADER_OPTIONS } });
    return;
  }

  if (url.pathname.startsWith('/sub')) {
    const pageMatch = url.pathname.match(/^\/sub\/(\d+)$/);
    const pageIndex = parseInt(pageMatch ? pageMatch[1] : '0', 10) || 0;
    const countrySelect = url.searchParams.get('cc')?.split(',');
    const customProxyBank = url.searchParams.get('proxy-list') || proxyBankUrl;
    let proxyList = await getProxyList(customProxyBank);
    if (countrySelect?.length) {
      proxyList = proxyList.filter((proxy) => countrySelect.includes(proxy.country));
    }
    const hostHeader = extractHost(req.headers.host);
    const serviceLabel = getServiceLabel(req.headers.host);
    const html = await getAllConfig(req, hostHeader, proxyList, pageIndex, serviceLabel);
    buildResponse(res, html, {
      status: 200,
      headers: { 'Content-Type': negotiateContentType(url.pathname) },
    });
    return;
  }

  if (url.pathname.startsWith('/check')) {
    const target = url.searchParams.get('target');
    if (!target) {
      httpError(res, 400, 'target query missing', CORS_HEADER_OPTIONS);
      return;
    }
    const [targetHost, targetPort = '443'] = target.split(':');
    try {
      const result = await checkProxyHealth(targetHost, targetPort);
      buildResponse(res, JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADER_OPTIONS },
      });
    } catch (error) {
      httpError(res, 502, error.message, CORS_HEADER_OPTIONS);
    }
    return;
  }

  if (url.pathname.startsWith('/api/v1/sub')) {
    const filterCC = url.searchParams.get('cc')?.split(',').filter(Boolean) || [];
    const filterPort = url.searchParams.get('port')?.split(',').map((v) => Number(v.trim())).filter(Boolean) || portOptions;
    const filterVPN = url.searchParams.get('vpn')?.split(',').filter(Boolean) || protocolOptions;
    const filterLimit = parseInt(url.searchParams.get('limit') || '10', 10);
    const filterFormat = url.searchParams.get('format') || 'raw';
    const serviceLabel = getServiceLabel(req.headers.host);
    const fillerDomain = url.searchParams.get('domain') || getAppDomain(req.headers.host);
    const customProxyBank = url.searchParams.get('proxy-list') || proxyBankUrl;

    let proxyList = await getProxyList(customProxyBank);
    if (filterCC.length) {
      proxyList = proxyList.filter((proxy) => filterCC.includes(proxy.country));
    }
    shuffleArray(proxyList);

    const uuid = crypto.randomUUID();
    const result = [];

    for (const proxy of proxyList) {
      const uri = new URL(`${reverse('najort')}://${fillerDomain}`);
      uri.searchParams.set('encryption', 'none');
      uri.searchParams.set('type', 'ws');
      uri.searchParams.set('host', fillerDomain);

      for (const port of filterPort) {
        for (const protocol of filterVPN) {
          if (result.length >= filterLimit) break;
          uri.protocol = protocol;
          uri.port = port.toString();
          if (protocol === 'ss') {
            uri.username = btoa(`none:${uuid}`);
            uri.searchParams.set(
              'plugin',
              `v2ray-plugin${port === 80 ? '' : ';tls'};mux=0;mode=websocket;path=/${proxy.proxyIP}-${proxy.proxyPort};host=${fillerDomain}`
            );
          } else {
            uri.username = uuid;
          }
          uri.searchParams.set('security', port === 443 ? 'tls' : 'none');
          uri.searchParams.set('sni', port === 80 && protocol === 'vless' ? '' : fillerDomain);
          uri.searchParams.set('path', `/${proxy.proxyIP}-${proxy.proxyPort}`);
          uri.hash = `${result.length + 1} ${getFlagEmoji(proxy.country)} ${proxy.org} WS ${port === 443 ? 'TLS' : 'NTLS'} [${serviceLabel}]`;
          result.push(uri.toString());
        }
      }
      if (result.length >= filterLimit) {
        break;
      }
    }

    let finalResult = '';
    switch (filterFormat) {
      case 'raw':
        finalResult = result.join('\n');
        break;
      case 'v2ray':
        finalResult = btoa(result.join('\n'));
        break;
      case 'clash':
      case 'sfa':
      case 'bfr': {
        const resConverter = await fetch(converterUrl, {
          method: 'POST',
          body: JSON.stringify({ url: result.join(','), format: filterFormat, template: 'cf' }),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!resConverter.ok) {
          httpError(res, resConverter.status, resConverter.statusText, CORS_HEADER_OPTIONS);
          return;
        }
        finalResult = await resConverter.text();
        break;
      }
      default:
        httpError(res, 400, 'unsupported format', CORS_HEADER_OPTIONS);
        return;
    }

    buildResponse(res, finalResult, {
      status: 200,
      headers: { ...CORS_HEADER_OPTIONS },
    });
    return;
  }

  if (url.pathname.startsWith('/api/v1/myip')) {
    const responseBody = {
      ip: req.headers['x-real-ip'] || req.socket.remoteAddress,
      colo: null,
      request: {
        headers: req.headers,
      },
    };
    buildResponse(res, JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADER_OPTIONS },
    });
    return;
  }

  if (reverseProxyTarget) {
    try {
      await reverseProxy(req, res, reverseProxyTarget);
    } catch (error) {
      console.error('Reverse proxy error', error);
      httpError(res, 502, 'Reverse proxy error');
    }
    return;
  }

  httpError(res, 404, 'Not Found');
}

const server = http.createServer(handleHttpRequest);

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  websocketHandler(ws, request);
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.headers['upgrade']?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  if (url.pathname.length === 3 || url.pathname.includes(',')) {
    const proxyKeys = url.pathname.replace('/', '').toUpperCase().split(',');
    getKVProxyList()
      .then((kvProxy) => {
        const proxyKey = proxyKeys[Math.floor(Math.random() * proxyKeys.length)];
        const proxies = kvProxy[proxyKey];
        if (!proxies || proxies.length === 0) {
          socket.destroy();
          return;
        }
        proxyIP = proxies[Math.floor(Math.random() * proxies.length)];
        completeUpgrade();
      })
      .catch((error) => {
        console.error('KV proxy lookup failed', error);
        socket.destroy();
      });
    return;
  }

  const proxyMatch = parseProxyPath(url.pathname);
  if (proxyMatch) {
    proxyIP = proxyMatch;
  }

  completeUpgrade();

  function completeUpgrade() {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

server.listen(listenPort, () => {
  console.log(`Server listening on port ${listenPort}`);
});
