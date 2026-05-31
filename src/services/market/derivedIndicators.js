import { calculateADX, calculateBollingerBands, calculateEMA, calculateMACD, calculateOBV, calculateRSI, calculateStochasticRSI } from '../../utils/indicators';

export function calculateIndicators(candles) {
  const closes = candles.map(candle => candle.close).filter(Boolean);
  if (closes.length < 30) return {};

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bollingerBands = calculateBollingerBands(closes);
  const stochRSI = calculateStochasticRSI(closes);
  const adx = calculateADX(candles);
  const obv = calculateOBV(candles);
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
    stochRSI,
    adx,
    obv,
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
