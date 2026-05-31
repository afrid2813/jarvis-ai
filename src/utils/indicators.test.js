import { calculateBollingerBands, calculateEMA, calculateMACD, calculateRSI, rollingEMA } from './indicators';

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
