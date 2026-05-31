import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

const PUBLIC_PORT = Number(process.env.PORT || 3000);
const REACT_PORT = Number(process.env.REACT_PORT || 3001);

function loadEnvFile(file) {
  const path = resolve(file);
  if (!existsSync(path)) return;

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const { default: chatHandler } = await import('../api/chat.js');
const { default: newsHandler } = await import('../api/news.js');

const API_ROUTES = new Map([
  ['/api/chat', chatHandler],
  ['/api/news', newsHandler],
]);

const react = spawn('npm', ['run', 'start:react'], {
  env: {
    ...process.env,
    BROWSER: 'none',
    PORT: String(REACT_PORT),
  },
  stdio: 'inherit',
});

react.on('exit', code => {
  if (code && code !== 0) {
    process.exit(code);
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);

      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
  });
}

function createResponse(res) {
  let statusCode = 200;

  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
    },
    end(payload) {
      if (!res.headersSent) {
        res.statusCode = statusCode;
      }
      res.end(payload);
    },
  };
}

async function handleApi(req, res, handler, parsedUrl) {
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());
  req.body = await readBody(req);
  await handler(req, createResponse(res));
}

function proxyToReact(req, res) {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: REACT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, proxyRes => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Jarvis dev server is starting. Refresh in a moment.');
  });

  req.pipe(proxyReq);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PUBLIC_PORT}`}`);
  const handler = API_ROUTES.get(parsedUrl.pathname);

  if (!handler) {
    proxyToReact(req, res);
    return;
  }

  try {
    await handleApi(req, res, handler, parsedUrl);
  } catch (err) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      path: parsedUrl.pathname,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      error: err.message,
    }));
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  }
});

server.listen(PUBLIC_PORT, () => {
  console.log(`Jarvis local API proxy running at http://localhost:${PUBLIC_PORT}`);
  console.log(`React dev server proxied from http://localhost:${REACT_PORT}`);
});

function shutdown() {
  server.close();
  react.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
