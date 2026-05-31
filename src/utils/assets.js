// src/utils/assets.js
// ─────────────────────────────────────────────
// Default asset data.
// Later you can replace these with live API calls
// from CoinGecko (crypto) or Alpha Vantage (stocks/forex).
// ─────────────────────────────────────────────

export const ASSETS = [
  {
    symbol: 'BTC/USD',
    price: 103420,
    change: 2.34,
    market: 'crypto',
    volume: '24.1B',
    rsi: 62,
    macd: 'Positive',
    ema: 'Above 200 EMA',
    trend: 'Bullish',
  },
  {
    symbol: 'ETH/USD',
    price: 2518,
    change: -1.12,
    market: 'crypto',
    volume: '9.4B',
    rsi: 48,
    macd: 'Flat',
    ema: 'Below 50 EMA',
    trend: 'Neutral',
  },
  {
    symbol: 'SPY',
    price: 584.22,
    change: 0.67,
    market: 'stocks',
    volume: '52.1B',
    rsi: 57,
    macd: 'Positive',
    ema: 'Above 200 EMA',
    trend: 'Bullish',
  },
  {
    symbol: 'AAPL',
    price: 213.45,
    change: 1.23,
    market: 'stocks',
    volume: '4.8B',
    rsi: 54,
    macd: 'Positive',
    ema: 'Above 50 EMA',
    trend: 'Bullish',
  },
  {
    symbol: 'EUR/USD',
    price: 1.0842,
    change: -0.21,
    market: 'forex',
    volume: '—',
    rsi: 45,
    macd: 'Negative',
    ema: 'Below 200 EMA',
    trend: 'Bearish',
  },
  {
    symbol: 'GLD',
    price: 3122.80,
    change: 0.44,
    market: 'commod',
    volume: '1.2B',
    rsi: 61,
    macd: 'Positive',
    ema: 'Above 200 EMA',
    trend: 'Bullish',
  },
];

export const AGENTS = [
  { name: 'Market Agent',    icon: '📈', desc: 'Price · Volume · Trend' },
  { name: 'Technical Agent', icon: '📊', desc: 'RSI · MACD · EMA' },
  { name: 'News Agent',      icon: '📰', desc: 'Events · Macro Impact' },
  { name: 'Sentiment Agent', icon: '🧠', desc: 'Fear / Greed · Emotion' },
  { name: 'Risk Agent',      icon: '🛡️', desc: 'Volatility · Safety' },
  { name: 'Strategy Agent',  icon: '🎯', desc: 'Entry · SL · TP' },
  { name: 'Fusion Agent',    icon: '⚡', desc: 'Final Decision' },
];

export function formatPrice(asset) {
  const p = asset.price;
  if (p < 10) return p.toFixed(4);
  if (p < 100) return p.toFixed(2);
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getAssetsByMarket(market) {
  return ASSETS.filter(asset => asset.market === market);
}

export function saveAlerts(alerts) {
  try {
    window.localStorage.setItem('jarvis.alerts.v1', JSON.stringify(alerts));
  } catch {
    // Alerts remain in memory when localStorage is unavailable.
  }
}

export function loadAlerts() {
  try {
    const alerts = JSON.parse(window.localStorage.getItem('jarvis.alerts.v1'));
    return Array.isArray(alerts) ? alerts : [];
  } catch {
    return [];
  }
}
