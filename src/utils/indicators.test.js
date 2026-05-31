import { calculateADX, calculateBollingerBands, calculateEMA, calculateMACD, calculateOBV, calculateRSI, calculateStochasticRSI, rollingEMA } from './indicators';

test('calculateRSI returns a known 5-period RSI', () => {
  expect(calculateRSI([1, 2, 3, 2, 4, 5], 5)).toBe(83);
});

test('calculateEMA returns the last EMA value for a small series', () => {
  expect(calculateEMA([10, 11, 12, 13], 3)).toBeCloseTo(12, 5);
});

test('calculateMACD histogram is positive when short trend is stronger than long trend', () => {
  const values = [
    ...Array(30).fill(10),
    12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
  ];
  expect(calculateMACD(values).histogram).toBeGreaterThan(0);
});

test('rollingEMA preserves array length and starts with null warmup values', () => {
  const values = [10, 11, 12, 13, 14];
  const result = rollingEMA(values, 3);

  expect(result).toHaveLength(values.length);
  expect(result[0]).toBeNull();
  expect(result[1]).toBeNull();
  expect(result[2]).not.toBeNull();
});

test('calculateBollingerBands returns equal bands for a flat series', () => {
  const bands = calculateBollingerBands(Array(20).fill(42));

  expect(bands.upper).toBe(42);
  expect(bands.middle).toBe(42);
  expect(bands.lower).toBe(42);
});

test('calculateStochasticRSI returns high k for a strongly rising series', () => {
  const values = [
    10, 11, 10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16,
    18, 17, 19, 18, 20, 19, 22, 24, 27, 31, 36, 42, 49, 57, 66,
    76, 87, 99, 112,
  ];

  expect(calculateStochasticRSI(values).k).toBeGreaterThan(50);
});

test('calculateADX returns null for a flat series with zero true range', () => {
  const candles = Array.from({ length: 40 }, (_, index) => ({
    timestamp: index,
    open: 10,
    high: 10,
    low: 10,
    close: 10,
    volume: 100,
  }));

  expect(calculateADX(candles)).toBeNull();
});

test('calculateADX returns strong trend for rising candles', () => {
  const candles = Array.from({ length: 50 }, (_, index) => ({
    timestamp: index,
    open: 10 + index,
    high: 12 + index,
    low: 9 + index,
    close: 11 + index,
    volume: 100 + index,
  }));

  expect(calculateADX(candles).adx).toBeGreaterThan(25);
});

test('calculateOBV accumulates positively for rising closes', () => {
  const candles = [
    { close: 10, volume: 100 },
    { close: 11, volume: 200 },
    { close: 12, volume: 300 },
  ];

  expect(calculateOBV(candles)).toBe(500);
});

test('calculateOBV returns null for fewer than two candles', () => {
  expect(calculateOBV([{ close: 10, volume: 100 }])).toBeNull();
});
