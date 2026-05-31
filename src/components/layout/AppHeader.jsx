import React from 'react';

function formatUpdateTime(value) {
  if (!value) return 'Static snapshot';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AppHeader({ compareMode, marketStatus, provider, refreshNow, setCompareMode }) {
  const marketBadge = marketStatus.state === 'loading'
    ? 'Refreshing market data'
    : marketStatus.state === 'error'
      ? 'Market data fallback'
      : marketStatus.state === 'warning'
        ? 'Some feeds stale'
        : `Updated ${formatUpdateTime(marketStatus.updatedAt)}`;

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">JAR<span>VIS</span></div>
        <div className="badge badge-blue">Ruflo Multi-Agent v2</div>
        <button className="badge badge-green badge-button" onClick={refreshNow} disabled={marketStatus.state === 'loading'}>
          {marketStatus.state === 'loading' ? 'Refreshing' : 'Live'}
        </button>
        <button className="badge badge-gray badge-button" onClick={() => setCompareMode(value => !value)}>
          {compareMode ? 'Compare On' : 'Compare'}
        </button>
      </div>
      <div className="header-right">
        <div className={`badge ${marketStatus.state === 'error' || marketStatus.state === 'warning' ? 'badge-warn' : 'badge-gray'}`} title={marketStatus.error || ''}>
          {marketBadge}
        </div>
        <div className="badge badge-gray">
          AI: {provider.toUpperCase()}
        </div>
      </div>
    </header>
  );
}
