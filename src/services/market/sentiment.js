import { fetchWithTimeout } from '../shared/fetchWithTimeout';

export async function fetchFearAndGreed() {
  try {
    const response = await fetchWithTimeout('https://api.alternative.me/fng/?limit=1', {}, 6500);
    if (!response.ok) return null;

    const payload = await response.json();
    const item = payload?.data?.[0];
    if (!item) return null;

    return {
      value: Number(item.value),
      classification: item.value_classification,
    };
  } catch {
    return null;
  }
}
