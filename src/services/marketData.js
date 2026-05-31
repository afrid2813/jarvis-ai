import { calculatePriceLevels } from '../utils/indicators';
import { BINANCE_SYMBOLS, fetchCryptoMarketData } from './market/crypto';
import { calculateIndicators } from './market/derivedIndicators';
import { YAHOO_SYMBOLS, fetchStockPrice } from './market/equities';
import { fetchForexPrice } from './market/forex';
import { formatVolume } from './market/format';
export { fetchNewsHeadlines } from './market/news';
export { fetchFearAndGreed } from './market/sentiment';

async function updateAsset(asset) {
  if (asset.market === 'crypto') {
    const binanceSymbol = BINANCE_SYMBOLS[asset.symbol];
    if (!binanceSymbol) return asset;

    const marketData = await fetchCryptoMarketData(binanceSymbol);
    return {
      ...asset,
      price: parseFloat(marketData.price.toFixed(2)),
      change: marketData.change,
      volume: formatVolume(marketData.volume),
      candles: marketData.candles,
      dataSource: marketData.source,
      candleInterval: marketData.interval,
      ...calculateIndicators(marketData.candles),
      ...calculatePriceLevels(marketData.candles),
      lastUpdated: new Date().toISOString(),
      stale: false,
    };
  }

  if (asset.market === 'stocks' || asset.market === 'commod') {
    const stockData = await fetchStockPrice(YAHOO_SYMBOLS[asset.symbol] || asset.symbol);
    if (!stockData) return { ...asset, stale: true };

    return {
      ...asset,
      price: parseFloat(stockData.price.toFixed(2)),
      change: stockData.change,
      volume: formatVolume(stockData.volume),
      candles: stockData.candles,
      ...calculateIndicators(stockData.candles),
      ...calculatePriceLevels(stockData.candles),
      dataSource: 'Yahoo chart proxy',
      candleInterval: '1d',
      lastUpdated: new Date().toISOString(),
      stale: false,
    };
  }

  if (asset.market === 'forex' && asset.symbol === 'EUR/USD') {
    const forexData = await fetchForexPrice();
    if (!forexData) return asset;

    return {
      ...asset,
      price: parseFloat(forexData.price.toFixed(4)),
      change: forexData.change,
      volume: forexData.volume,
      candles: asset.candles || [],
      dataSource: forexData.dataSource,
      candleInterval: forexData.candleInterval,
      lastUpdated: new Date().toISOString(),
      stale: false,
    };
  }

  return asset;
}

export async function fetchAllMarketData(currentAssets) {
  return Promise.all(currentAssets.map(async asset => {
    try {
      return await updateAsset(asset);
    } catch (err) {
      console.warn(`Failed to update ${asset.symbol}:`, err.message);
      return {
        ...asset,
        stale: true,
        staleReason: err.name === 'AbortError' ? 'Market data timeout' : err.message,
        dataSource: asset.dataSource || 'fallback',
      };
    }
  }));
}
