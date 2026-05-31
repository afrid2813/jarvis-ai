import { kv } from '@vercel/kv';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

const NEWS_SEARCH_TERMS = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
  'SOL/USD': 'solana',
  SPY: 'S&P 500',
  AAPL: 'Apple stock',
  'EUR/USD': 'euro dollar',
  GLD: 'gold price',
};

const rateLimits = new Map();
const MAX_REQUESTS = 10;
const WINDOW_MS = 60 * 1000;

function getIp(req) {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

function logError({ path, ip, err }) {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    path,
    ip,
    error: err.message,
  }));
}

async function checkRateLimit(ip) {
  try {
    const key = `ratelimit:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, 60);
    return count <= MAX_REQUESTS;
  } catch {
    return checkMemoryRateLimit(ip);
  }
}

function checkMemoryRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip) || { count: 0, start: now };

  if (now - record.start > WINDOW_MS) {
    record.count = 0;
    record.start = now;
  }

  record.count++;
  rateLimits.set(ip, record);

  return record.count <= MAX_REQUESTS;
}

export default async function handler(req, res) {
  const ip = getIp(req);

  try {
    const origin = req.headers.origin;

    if (origin !== ALLOWED_ORIGIN) {
      return res.status(403).json({ articles: [] });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ articles: [] });

    if (!(await checkRateLimit(ip))) {
      return res.status(429).json({ articles: [] });
    }

    const key = process.env.NEWS_KEY;
    if (!key) return res.status(200).json({ articles: [] });

    const symbol = String(req.query?.symbol || '');
    const searchTerm = NEWS_SEARCH_TERMS[symbol] || symbol;
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchTerm)}&pageSize=5&sortBy=publishedAt&apiKey=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(200).json({ articles: [] });

    const payload = await response.json();
    const articles = Array.isArray(payload?.articles)
      ? payload.articles.slice(0, 5).map(article => ({
        title: article.title || 'Untitled',
        source: article.source?.name || 'Unknown source',
        publishedAt: article.publishedAt || null,
      }))
      : [];

    return res.status(200).json({ articles });
  } catch (err) {
    logError({ path: '/api/news', ip, err });
    return res.status(500).json({ error: 'Internal error', articles: [] });
  }
}
