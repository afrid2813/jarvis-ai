import React from 'react';
import { formatPrice } from '../utils/assets';

export default function Watchlist({ watchlist, assets, currentSymbol, onAdd, onRemove, onSelect }) {
  const watchedAssets = watchlist
    .map(symbol => assets.find(asset => asset.symbol === symbol))
    .filter(Boolean);

  return (
    <details className="card" open>
      <summary className="card-title trade-journal-summary">
        Watchlist <span className="phase-pill phase-2">{watchlist.length}/10</span>
      </summary>
      <button className="quick-btn" onClick={() => onAdd(currentSymbol)} disabled={watchlist.length >= 10 || watchlist.includes(currentSymbol)}>
        Add current
      </button>

      {!watchedAssets.length ? (
        <div className="no-signal">No watched symbols yet.</div>
      ) : (
        <div className="evolution-list">
          {watchedAssets.map(asset => (
            <div className="evolution-row" key={asset.symbol}>
              <button className="quick-btn" onClick={() => onSelect(asset.symbol)}>
                ★ {asset.symbol}
              </button>
              <span>{formatPrice(asset)}</span>
              <span className={asset.change >= 0 ? 'up' : 'dn'}>
                {asset.change >= 0 ? '+' : ''}{asset.change}%
              </span>
              <button className="quick-btn" onClick={() => onRemove(asset.symbol)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
