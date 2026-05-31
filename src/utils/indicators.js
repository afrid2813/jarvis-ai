export function calculateRSI(closes, period = 14) {
  const slice = closes.slice(-(period + 1));
  if (slice.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < slice.length; i++) {
    const change = slice[i] - slice[i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) return 100;

  const relativeStrength = averageGain / averageLoss;
  return Math.round(100 - (100 / (1 + relativeStrength)));
}

export function calculateEMA(values, period) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (const value of values.slice(period)) {
    ema = (value - ema) * multiplier + ema;
  }

  return ema;
}

export function rollingEMA(values, period) {
  const result = Array(values.length).fill(null);
  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result[i] = ema;
  }

  return result;
}

export function calculateMACD(closes) {
  const ema12 = rollingEMA(closes, 12);
  const ema26 = rollingEMA(closes, 26);
  const macdSeries = closes
    .map((_, index) => {
      if (ema12[index] == null || ema26[index] == null) return null;
      return ema12[index] - ema26[index];
    })
    .filter(value => value != null);

  const signalSeries = rollingEMA(macdSeries, 9).filter(value => value != null);
  const macdLine = macdSeries[macdSeries.length - 1] || 0;
  const signalLine = signalSeries[signalSeries.length - 1] || 0;

  return {
    macdLine,
    signalLine,
    histogram: macdLine - signalLine,
  };
}

export function calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const middle = slice.reduce((sum, value) => sum + value, 0) / period;
  const variance = slice.reduce((sum, value) => sum + ((value - middle) ** 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + stdDevMultiplier * stdDev,
    middle,
    lower: middle - stdDevMultiplier * stdDev,
  };
}

export function calculateStochasticRSI(closes, rsiPeriod = 14, stochPeriod = 14) {
  if (closes.length < rsiPeriod + stochPeriod + 3) return null;

  const rsiValues = [];
  for (let i = rsiPeriod; i < closes.length; i++) {
    const rsi = calculateRSI(closes.slice(i - rsiPeriod, i + 1), rsiPeriod);
    if (rsi == null) return null;
    rsiValues.push(rsi);
  }

  const kValues = [];
  for (let i = rsiValues.length - 3; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    if (window.length < stochPeriod) return null;

    const minRSI = Math.min(...window);
    const maxRSI = Math.max(...window);
    const range = maxRSI - minRSI;
    if (range === 0) return null;

    kValues.push(((rsiValues[i] - minRSI) / range) * 100);
  }

  const k = kValues[kValues.length - 1];
  const d = kValues.reduce((sum, value) => sum + value, 0) / kValues.length;
  if (!Number.isFinite(k) || !Number.isFinite(d)) return null;

  return { k, d };
}

export function calculateADX(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period * 2 + 1) return null;

  const trueRanges = [];
  const plusDMs = [];
  const minusDMs = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    const highDiff = current.high - previous.high;
    const lowDiff = previous.low - current.low;
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    );

    trueRanges.push(trueRange);
    plusDMs.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDMs.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }

  const smoothTR = wilderSmooth(trueRanges, period);
  const smoothPlusDM = wilderSmooth(plusDMs, period);
  const smoothMinusDM = wilderSmooth(minusDMs, period);
  const dxValues = [];
  let lastPlusDI = null;
  let lastMinusDI = null;

  for (let i = 0; i < smoothTR.length; i++) {
    if (!smoothTR[i]) return null;

    const plusDI = 100 * smoothPlusDM[i] / smoothTR[i];
    const minusDI = 100 * smoothMinusDM[i] / smoothTR[i];
    const diSum = plusDI + minusDI;
    if (!diSum) return null;

    lastPlusDI = plusDI;
    lastMinusDI = minusDI;
    dxValues.push(100 * Math.abs(plusDI - minusDI) / diSum);
  }

  if (dxValues.length < period) return null;
  const adxSeries = wilderSmooth(dxValues, period).map(value => value / period);
  const adx = adxSeries[adxSeries.length - 1];
  if (!Number.isFinite(adx)) return null;

  return {
    adx: roundToOne(adx),
    plusDI: roundToOne(lastPlusDI),
    minusDI: roundToOne(lastMinusDI),
  };
}

export function calculateOBV(candles) {
  if (!Array.isArray(candles) || candles.length < 2) return null;

  return candles.slice(1).reduce((obv, candle, index) => {
    const previous = candles[index];
    const volume = Number(candle.volume || candle.quoteVolume || 0);
    if (candle.close > previous.close) return obv + volume;
    if (candle.close < previous.close) return obv - volume;
    return obv;
  }, 0);
}

export function calculatePriceLevels(candles) {
  if (!candles || candles.length < 10) return {};

  const recent = candles.slice(-48);
  const highs = recent.map(candle => candle.high).filter(Boolean);
  const lows = recent.map(candle => candle.low).filter(Boolean);
  const volumes = recent.map(candle => candle.volume || candle.quoteVolume || 0);
  const closes = recent.map(candle => candle.close).filter(Boolean);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  const firstVolume = average(volumes.slice(0, Math.ceil(volumes.length / 2)));
  const secondVolume = average(volumes.slice(Math.ceil(volumes.length / 2)));
  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];

  return {
    support: parseFloat(support.toFixed(2)),
    resistance: parseFloat(resistance.toFixed(2)),
    volumeTrend: secondVolume > firstVolume * 1.08 ? 'Rising' : secondVolume < firstVolume * 0.92 ? 'Falling' : 'Stable',
    candleTrend: lastClose > firstClose ? 'Up' : lastClose < firstClose ? 'Down' : 'Flat',
  };
}

function wilderSmooth(values, period) {
  if (values.length < period) return [];

  const result = [];
  let smoothed = values.slice(0, period).reduce((sum, value) => sum + value, 0);
  result.push(smoothed);

  for (let i = period; i < values.length; i++) {
    smoothed = smoothed - (smoothed / period) + values[i];
    result.push(smoothed);
  }

  return result;
}

function roundToOne(value) {
  return Math.round(value * 10) / 10;
}

function average(values) {
  const clean = values.filter(value => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
