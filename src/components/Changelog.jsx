import React from 'react';

const CHANGELOG = [
  { version: 'v1.6', date: '2025-06', notes: 'Stoch RSI, volume profile, custom hooks, export tests' },
  { version: 'v1.5', date: '2025-06', notes: 'Bollinger Bands, price alerts, keyboard shortcuts, stale banner' },
  { version: 'v1.4', date: '2025-06', notes: 'News headlines panel, compare mode, indicators extracted to indicators.js' },
  { version: 'v1.3', date: '2025-05', notes: 'Trade journal, CSV export, error boundary, prompt injection hardening' },
  { version: 'v1.2', date: '2025-05', notes: 'NewsAPI server-side, EUR/USD live feed, Fear & Greed index' },
  { version: 'v1.1', date: '2025-05', notes: 'Component split, MACD fix, security hardening, skeleton loader' },
  { version: 'v1.0', date: '2025-05', notes: 'Initial release: live market data, multi-agent AI, self-evolving OS' },
];

export default function Changelog() {
  return (
    <details className="card">
      <summary className="card-title trade-journal-summary">What's new</summary>
      <div className="evolution-list">
        {CHANGELOG.map(entry => (
          <div className="evolution-row" key={entry.version}>
            <span className="phase-pill phase-2">{entry.version}</span>
            <span>{entry.date}</span>
            <span>{entry.notes}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
