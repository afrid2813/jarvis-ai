import { applyCors, createMemoryRateLimiter, fetchJsonWithTimeout, getClientIp, logError } from './_shared.js';

const NEWS_SEARCH_TERMS = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
  'SOL/USD': 'solana',
  SPY: 'S&P 500',
  AAPL: 'Apple stock',
  'EUR/USD': 'euro dollar',
  GLD: 'gold price',
};

const checkRateLimit = createMemoryRateLimiter({ maxRequests: 10, windowMs: 60 * 1000 });

export default async function handler(req, res) {
  const ip = getClientIp(req);

  try {
    if (!applyCors(req, res, ['GET', 'OPTIONS'])) {
      return res.status(403).json({ articles: [] });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ articles: [] });

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ articles: [] });
    }

    const key = process.env.NEWS_KEY;
    if (!key) return res.status(200).json({ articles: [] });

    const symbol = String(req.query?.symbol || '');
    const searchTerm = NEWS_SEARCH_TERMS[symbol] || symbol;
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchTerm)}&pageSize=5&sortBy=publishedAt&apiKey=${encodeURIComponent(key)}`;
    const { response, data: payload } = await fetchJsonWithTimeout(url, {}, 6500);
    if (!response.ok) return res.status(200).json({ articles: [] });

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
