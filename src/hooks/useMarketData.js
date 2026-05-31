import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllMarketData, fetchFearAndGreed } from '../services/marketData';

export function useMarketData(initialAssets) {
  const [assets, setAssets] = useState(initialAssets);
  const [marketStatus, setMarketStatus] = useState({ state: 'idle', updatedAt: null, error: null });
  const [marketReady, setMarketReady] = useState(false);
  const [dismissStale, setDismissStale] = useState(false);
  const [fearAndGreed, setFearAndGreed] = useState(null);
  const assetsRef = useRef(initialAssets);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const applyMarketData = useCallback((nextAssets, nextFearAndGreed) => {
    setAssets(nextAssets);
    setFearAndGreed(nextFearAndGreed);
    setDismissStale(false);
    setMarketReady(true);
    setMarketStatus({
      state: nextAssets.some(nextAsset => nextAsset.stale) ? 'warning' : 'ready',
      updatedAt: new Date().toISOString(),
      error: nextAssets
        .filter(nextAsset => nextAsset.stale)
        .map(nextAsset => `${nextAsset.symbol}: ${nextAsset.staleReason || 'stale'}`)
        .join(' · ') || null,
    });
  }, []);

  const refreshNow = useCallback(async () => {
    setMarketStatus(prev => ({ ...prev, state: 'loading', error: null }));

    try {
      const [nextAssets, nextFearAndGreed] = await Promise.all([
        fetchAllMarketData(assetsRef.current),
        fetchFearAndGreed(),
      ]);
      applyMarketData(nextAssets, nextFearAndGreed);
    } catch (err) {
      setMarketStatus(prev => ({ ...prev, state: 'error', error: err.message }));
    }
  }, [applyMarketData]);

  useEffect(() => {
    let cancelled = false;

    async function refreshMarketData(silent = false) {
      if (!silent) setMarketStatus(prev => ({ ...prev, state: 'loading', error: null }));

      try {
        const [nextAssets, nextFearAndGreed] = await Promise.all([
          fetchAllMarketData(assetsRef.current),
          fetchFearAndGreed(),
        ]);
        if (!cancelled) applyMarketData(nextAssets, nextFearAndGreed);
      } catch (err) {
        if (!cancelled) setMarketStatus(prev => ({ ...prev, state: 'error', error: err.message }));
      }
    }

    refreshMarketData();
    const refreshId = setInterval(() => refreshMarketData(true), 60_000);

    return () => {
      cancelled = true;
      clearInterval(refreshId);
    };
  }, [applyMarketData]);

  return {
    assets,
    marketStatus,
    marketReady,
    hasStaleAssets: assets.some(asset => asset.stale),
    dismissStale,
    setDismissStale,
    fearAndGreed,
    refreshNow,
    setAssets,
    setFearAndGreed,
  };
}
