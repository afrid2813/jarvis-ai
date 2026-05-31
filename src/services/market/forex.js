import { fetchWithTimeout } from '../shared/fetchWithTimeout';

export async function fetchForexPrice() {
  try {
    const response = await fetchWithTimeout('https://open.er-api.com/v6/latest/EUR', {}, 6500);
    if (!response.ok) return null;

    const data = await response.json();
    const price = Number(data?.rates?.USD);
    if (!Number.isFinite(price)) return null;

    return {
      price,
      change: 0,
      volume: '—',
      dataSource: 'ExchangeRate-API',
      candleInterval: 'spot',
    };
  } catch {
    return null;
  }
}
