import { fetchWithTimeout } from '../shared/fetchWithTimeout';

export async function fetchNewsHeadlines(symbol) {
  try {
    const url = `/api/news?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetchWithTimeout(url, {}, 6500);
    if (!response.ok) return null;

    const payload = await response.json();
    return Array.isArray(payload?.articles) ? payload.articles : null;
  } catch {
    return null;
  }
}
