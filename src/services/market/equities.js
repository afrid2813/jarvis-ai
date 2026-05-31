import { fetchWithTimeout } from '../shared/fetchWithTimeout';

export const YAHOO_SYMBOLS = {
  SPY: 'SPY',
  AAPL: 'AAPL',
  GLD: 'GLD',
};

export async function fetchStockPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    }, 6500);

    if (!response.ok) {
      throw new Error(`Yahoo Finance error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('No data returned from Yahoo Finance');

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const timestamps = result.timestamp || [];
    const candles = timestamps.map((ts, i) => ({
      timestamp: ts * 1000,
      open: quote.open?.[i] || closes[i],
      high: quote.high?.[i] || closes[i],
      low: quote.low?.[i] || closes[i],
      close: closes[i],
      volume: quote.volume?.[i] || 0,
    })).filter(candle => candle.close != null);
    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
    const prevClose = meta.previousClose || closes[closes.length - 2] || currentPrice;
    const change24h = ((currentPrice - prevClose) / prevClose) * 100;

    return {
      price: currentPrice,
      change: parseFloat(change24h.toFixed(2)),
      volume: meta.regularMarketVolume || 0,
      candles,
    };
  } catch (err) {
    console.warn(`Could not fetch stock data for ${symbol}:`, err.message);
    return null;
  }
}
