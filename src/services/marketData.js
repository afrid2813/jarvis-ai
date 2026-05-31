// src/services/marketData.js
// ─────────────────────────────────────────────────────────
// REAL market data service for Jarvis
//
// What this file does:
//   - Fetches real live-ish crypto candles from Binance public market data
//   - Fetches OHLCV candle data (needed to calculate real RSI/MACD)
//   - Updates every 30 seconds automatically
//   - Returns data in the same format the rest of Jarvis expects
//
// Binance public market data does not need an API key for prices/candles.
// ─────────────────────────────────────────────────────────

import { calculateBollingerBands, calculateEMA, calculateMACD, calculatePriceLevels, calculateRSI } from '../utils/indicators';

// ── Asset map ─────────────────────────────────────────────
const BINANCE_SYMBOLS = {
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
  'SOL/USD': 'SOLUSDT',
};

const BINANCE_BASE_URLS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
];

async function fetchWithTimeout(url, options = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// For stocks and forex we use a different source (Yahoo Finance proxy)
const YAHOO_SYMBOLS = {
  'SPY':     'SPY',
  'AAPL':    'AAPL',
  'GLD':     'GLD',
};

export async function fetchFearAndGreed() {
  try {
    const response = await fetchWithTimeout('https://api.alternative.me/fng/?limit=1', {}, 6500);
    if (!response.ok) return null;

    const payload = await response.json();
    const item = payload?.data?.[0];
    if (!item) return null;

    return {
      value: Number(item.value),
      classification: item.value_classification,
    };
  } catch {
    return null;
  }
}

export async function fetchNewsHeadlines(symbol) {
  try {
    const url = `/api/news?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetchWithTimeout(url, {}, 6500);
    if (!response.ok) return null;

    const payload = await response.json();
    return Array.isArray(payload?.articles) ? payload.articles : null;
  } catch {
    return null;
  }
}

async function fetchBinance(path) {
  let lastError = null;

  for (const baseUrl of BINANCE_BASE_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`);
      if (!response.ok) throw new Error(`Binance error: ${response.status}`);
      return response.json();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Binance request failed');
}

async function fetchCryptoMarketData(symbol) {
  const interval = '1h';
  const limit = 120;
  const [ticker, rawCandles] = await Promise.all([
    fetchBinance(`/api/v3/ticker/24hr?symbol=${symbol}`),
    fetchBinance(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`),
  ]);

  const candles = rawCandles.map(candle => ({
    timestamp: candle[0],
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]),
    closeTime: candle[6],
    quoteVolume: parseFloat(candle[7]),
  }));

  const lastCandle = candles[candles.length - 1];
  const currentPrice = parseFloat(ticker.lastPrice) || lastCandle.close;

  return {
    price: currentPrice,
    change: parseFloat(parseFloat(ticker.priceChangePercent || 0).toFixed(2)),
    volume: parseFloat(ticker.quoteVolume || 0),
    candles,
    source: 'Binance public',
    interval,
  };
}

// ── Fetch stock price from Yahoo Finance (via free proxy) ──
// Yahoo Finance does not have an official free API
// But there is a free community proxy that works the same way
async function fetchStockPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;

    const response = await fetchWithTimeout(url, {
      headers: {
        // Yahoo requires a user agent header or it rejects the request
        'User-Agent': 'Mozilla/5.0',
      }
    }, 6500);

    if (!response.ok) {
      throw new Error(`Yahoo Finance error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) throw new Error('No data returned from Yahoo Finance');

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const timestamps = result.timestamp || [];

    // Build candles array from the daily data
    const opens   = result.indicators?.quote?.[0]?.open   || [];
    const highs   = result.indicators?.quote?.[0]?.high   || [];
    const lows    = result.indicators?.quote?.[0]?.low    || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const candles = timestamps.map((ts, i) => ({
      timestamp: ts * 1000, // Yahoo uses seconds, we use milliseconds
      open:   opens[i]   || closes[i],
      high:   highs[i]   || closes[i],
      low:    lows[i]    || closes[i],
      close:  closes[i],
      volume: volumes[i] || 0,
    })).filter(c => c.close != null); // Remove any candles with missing data

    // Current price and 24h change
    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
    const prevClose    = meta.previousClose || closes[closes.length - 2] || currentPrice;
    const change24h    = ((currentPrice - prevClose) / prevClose) * 100;

    return {
      price:   currentPrice,
      change:  parseFloat(change24h.toFixed(2)),
      volume:  meta.regularMarketVolume || 0,
      candles: candles,
    };

  } catch (err) {
    console.warn(`Could not fetch stock data for ${symbol}:`, err.message);
    return null;
  }
}

async function fetchForexPrice() {
  try {
    const response = await fetchWithTimeout('https://open.er-api.com/v6/latest/EUR', {}, 6500);
    if (!response.ok) return null;

    const data = await response.json();
    const price = Number(data?.rates?.USD);
    if (!Number.isFinite(price)) return null;

    return {
      price,
      change: 0,
      volume: '—',
      dataSource: 'ExchangeRate-API',
      candleInterval: 'spot',
    };
  } catch {
    return null;
  }
}

// ── Main function: fetch ALL assets ───────────────────────
// This is the function the rest of Jarvis will call
// It returns a complete updated asset list with real data
export async function fetchAllMarketData(currentAssets) {
  const updated = [];

  for (const asset of currentAssets) {

    try {
      // ── Handle crypto assets ──
      if (asset.market === 'crypto') {
        const binanceSymbol = BINANCE_SYMBOLS[asset.symbol];

        if (!binanceSymbol) {
          // If we do not have a mapping, keep the existing data
          updated.push(asset);
          continue;
        }

        const marketData = await fetchCryptoMarketData(binanceSymbol);
        const volumeFormatted = formatVolume(marketData.volume);
        const derivedLevels = calculatePriceLevels(marketData.candles);

        updated.push({
          ...asset,                                    // Keep all existing fields
          price:   parseFloat(marketData.price.toFixed(2)),
          change:  marketData.change,
          volume:  volumeFormatted,
          candles: marketData.candles,                  // Raw candle data for chart + AI
          dataSource: marketData.source,
          candleInterval: marketData.interval,
          ...calculateIndicators(marketData.candles),
          ...derivedLevels,
          lastUpdated: new Date().toISOString(),
          stale: false,
        });

      // ── Handle stock assets ──
      } else if (asset.market === 'stocks' || asset.market === 'commod') {
        const yahooSymbol = YAHOO_SYMBOLS[asset.symbol] || asset.symbol;
        const stockData = await fetchStockPrice(yahooSymbol);

        if (stockData) {
          const volumeFormatted = formatVolume(stockData.volume);

          updated.push({
            ...asset,
            price:   parseFloat(stockData.price.toFixed(2)),
            change:  stockData.change,
            volume:  volumeFormatted,
            candles: stockData.candles,
            ...calculateIndicators(stockData.candles),
            ...calculatePriceLevels(stockData.candles),
            dataSource: 'Yahoo chart proxy',
            candleInterval: '1d',
            lastUpdated: new Date().toISOString(),
          });
        } else {
          // If fetch failed, keep existing data but mark it as stale
          updated.push({ ...asset, stale: true });
        }

      // ── Handle forex assets ──
      } else if (asset.market === 'forex' && asset.symbol === 'EUR/USD') {
        const forexData = await fetchForexPrice();

        if (forexData) {
          updated.push({
            ...asset,
            price: parseFloat(forexData.price.toFixed(4)),
            change: forexData.change,
            volume: forexData.volume,
            candles: asset.candles || [],
            dataSource: forexData.dataSource,
            candleInterval: forexData.candleInterval,
            lastUpdated: new Date().toISOString(),
            stale: false,
          });
        } else {
          updated.push(asset);
        }

      // ── Keep others unchanged for now ──
      } else {
        updated.push(asset);
      }

    } catch (err) {
      console.warn(`Failed to update ${asset.symbol}:`, err.message);
      // If anything fails, keep the old data rather than crashing
      updated.push({
        ...asset,
        stale: true,
        staleReason: err.name === 'AbortError' ? 'Market data timeout' : err.message,
        dataSource: asset.dataSource || 'fallback',
      });
    }
  }

  return updated;
}

// ── Helper: format large numbers into readable form ────────
// Example: 24100000000 → "24.1B"
function formatVolume(num) {
  if (!num || num === 0) return '—';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(1)     + 'M';
  if (num >= 1_000)         return (num / 1_000).toFixed(1)         + 'K';
  return num.toFixed(0);
}

function calculateIndicators(candles) {
  const closes = candles.map(candle => candle.close).filter(Boolean);
  if (closes.length < 30) return {};

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bollingerBands = calculateBollingerBands(closes);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const latestClose = closes[closes.length - 1];
  const trend = deriveTrend(latestClose, ema50, ema200, macd.histogram);

  return {
    rsi,
    macd: macd.histogram > 0 ? 'Positive' : macd.histogram < 0 ? 'Negative' : 'Flat',
    ema: ema200
      ? latestClose >= ema200 ? 'Above 200 EMA' : 'Below 200 EMA'
      : latestClose >= ema50 ? 'Above 50 EMA' : 'Below 50 EMA',
    trend,
    bollingerBands,
  };
}

function deriveTrend(price, ema50, ema200, macdHistogram) {
  if (ema200) {
    if (price > ema200 && macdHistogram >= 0) return 'Bullish';
    if (price < ema200 && macdHistogram < 0) return 'Bearish';
    return 'Neutral';
  }

  if (price > ema50 && macdHistogram >= 0) return 'Bullish';
  if (price < ema50 && macdHistogram < 0) return 'Bearish';
  return 'Neutral';
}
