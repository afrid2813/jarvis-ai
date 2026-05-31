import React from 'react';

export default function StaleMarketBanner({ hasStaleAssets, dismissStale, onDismiss }) {
  if (!hasStaleAssets || dismissStale) return null;

  return (
    <div className="stale-banner">
      <span>⚠ Some market data is stale — prices may not reflect current market.</span>
      <button className="quick-btn" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
