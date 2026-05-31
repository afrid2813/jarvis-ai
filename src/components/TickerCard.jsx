import React from 'react';
import { formatPrice } from '../utils/assets';

export default function TickerCard({ asset, selected, onClick }) {
  const up = asset.change >= 0;

  return (
    <div
      className={`ticker-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="ticker-top">
        <span className="ticker-symbol">{asset.symbol}</span>
        <span className={`ticker-market ${asset.stale ? 'stale' : ''}`}>
          {asset.stale ? 'stale' : asset.market}
        </span>
      </div>
      <div className="ticker-price">{formatPrice(asset)}</div>
      <div className={`ticker-change ${up ? 'up' : 'dn'}`}>
        {up ? '▲' : '▼'} {Math.abs(asset.change)}%
      </div>
    </div>
  );
}
