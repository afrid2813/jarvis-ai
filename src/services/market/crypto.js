import { fetchWithTimeout } from '../shared/fetchWithTimeout';

export const BINANCE_SYMBOLS = {
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
  'SOL/USD': 'SOLUSDT',
};

const BINANCE_BASE_URLS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
];

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

export async function fetchCryptoMarketData(symbol) {
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
