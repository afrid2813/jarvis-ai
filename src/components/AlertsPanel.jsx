import React, { useState } from 'react';
import { formatPrice } from '../utils/assets';

function isTriggered(alert, assets) {
  const asset = assets.find(item => item.symbol === alert.symbol);
  const price = Number(asset?.price);
  const threshold = Number(alert.price);
  if (!Number.isFinite(price) || !Number.isFinite(threshold)) return false;
  return alert.direction === 'above' ? price >= threshold : price <= threshold;
}

export default function AlertsPanel({ alerts, assets, onAdd, onRemove }) {
  const [symbol, setSymbol] = useState(assets[0]?.symbol || '');
  const [direction, setDirection] = useState('above');
  const [price, setPrice] = useState('');

  function submit(event) {
    event.preventDefault();
    const value = Number(price);
    if (!symbol || !Number.isFinite(value) || value <= 0) return;

    onAdd({ symbol, direction, price: value });
    setPrice('');
  }

  return (
    <details className="card" open>
      <summary className="card-title trade-journal-summary">Price Alerts</summary>

      <form className="quick-row" onSubmit={submit}>
        <select className="quick-btn" value={symbol} onChange={event => setSymbol(event.target.value)}>
          {assets.map(asset => (
            <option key={asset.symbol} value={asset.symbol}>{asset.symbol}</option>
          ))}
        </select>
        <button
          type="button"
          className="quick-btn"
          onClick={() => setDirection(value => value === 'above' ? 'below' : 'above')}
        >
          {direction}
        </button>
        <input
          className="chat-input"
          type="number"
          min="0"
          step="any"
          value={price}
          onChange={event => setPrice(event.target.value)}
          placeholder="Price"
        />
        <button className="quick-btn" type="submit">Add</button>
      </form>

      {!alerts.length ? (
        <div className="no-signal">No alerts set.</div>
      ) : (
        <div className="evolution-list">
          {alerts.map((alert, index) => {
            const triggered = isTriggered(alert, assets);
            const currentAsset = assets.find(asset => asset.symbol === alert.symbol);

            return (
              <div className="evolution-row" key={`${alert.symbol}-${alert.direction}-${alert.price}-${index}`}>
                <span className={triggered ? alert.direction === 'above' ? 'up' : 'dn' : ''}>
                  {alert.symbol} {alert.direction} {formatPrice({ price: Number(alert.price) })}
                  {triggered ? ' · 🔔 Triggered' : ''}
                  {currentAsset ? ` · now ${formatPrice(currentAsset)}` : ''}
                </span>
                <button className="quick-btn" onClick={() => onRemove(index)}>Remove</button>
              </div>
            );
          })}
        </div>
      )}
    </details>
  );
}
