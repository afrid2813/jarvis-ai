import { exportSummary } from './exportSummary';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalCreateElement = document.createElement.bind(document);
let latestBlobText = '';
let latestLink = null;

beforeEach(() => {
  latestBlobText = '';
  latestLink = null;
  global.Blob = jest.fn((chunks, options) => {
    latestBlobText = chunks.join('');
    return { chunks, options };
  });
  URL.createObjectURL = jest.fn(() => 'blob:jarvis-summary');
  URL.revokeObjectURL = jest.fn();
  document.createElement = jest.fn(tag => {
    if (tag !== 'a') return originalCreateElement(tag);
    latestLink = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    return latestLink;
  });
  jest.spyOn(document.body, 'appendChild').mockImplementation(node => node);
  jest.spyOn(document.body, 'removeChild').mockImplementation(node => node);
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  document.createElement = originalCreateElement;
  jest.restoreAllMocks();
});

const asset = {
  symbol: 'BTC/USD',
  price: 70000,
  change: 1.2,
  rsi: 62,
  macd: 'Positive',
  trend: 'Bullish',
  bollingerBands: { upper: 72000, middle: 70000, lower: 68000 },
};

test('exportSummary generates a report containing the asset symbol', () => {
  exportSummary(asset, { action: 'BUY', confidence: 70, risk: 'LOW' }, null, []);
  expect(latestBlobText).toContain('BTC/USD');
});

test('exportSummary generates a report containing the signal action', () => {
  exportSummary(asset, { action: 'BUY', confidence: 70, risk: 'LOW' }, null, []);
  expect(latestBlobText).toContain('BUY');
});

test('exportSummary falls back gracefully when lastSignal is null', () => {
  exportSummary(asset, null, null, []);
  expect(latestBlobText).toContain('Last Signal: Unavailable');
});

test('exportSummary filename contains the asset symbol and today date', () => {
  const today = new Date().toISOString().slice(0, 10);
  exportSummary(asset, null, null, []);

  expect(latestLink.download).toContain('btc-usd');
  expect(latestLink.download).toContain(today);
});
