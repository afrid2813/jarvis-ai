import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useMarketData } from './useMarketData';
import { fetchAllMarketData, fetchFearAndGreed } from '../services/marketData';

jest.mock('../services/marketData', () => ({
  fetchAllMarketData: jest.fn(),
  fetchFearAndGreed: jest.fn(),
}));

let container = null;
let root = null;

function Probe({ initialAssets, onState }) {
  const state = useMarketData(initialAssets);
  onState(state);
  return null;
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('useMarketData marks market ready after first successful refresh', async () => {
  const assets = [{ symbol: 'BTC/USD', price: 1, market: 'crypto' }];
  const refreshed = [{ symbol: 'BTC/USD', price: 2, market: 'crypto', stale: false }];
  const states = [];

  fetchAllMarketData.mockResolvedValue(refreshed);
  fetchFearAndGreed.mockResolvedValue({ value: 70, classification: 'Greed' });

  await act(async () => {
    root.render(<Probe initialAssets={assets} onState={state => states.push(state)} />);
  });
  await act(async () => {});

  const latest = states[states.length - 1];
  expect(latest.marketReady).toBe(true);
  expect(latest.assets[0].price).toBe(2);
  expect(latest.fearAndGreed.classification).toBe('Greed');
  expect(latest.marketStatus.state).toBe('ready');
});
