import React from 'react';
import { formatPrice } from '../utils/assets';

export default function CompareTable({ assets, selectedIdx, onSelect }) {
  return (
    <div className="card">
      <div className="card-title">Asset Comparison</div>
      <div className="trade-table-wrap">
        <table className="trade-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Price</th>
              <th>Change %</th>
              <th>RSI</th>
              <th>Trend</th>
              <th>MACD</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, index) => (
              <tr
                key={asset.symbol}
                onClick={() => onSelect(index)}
                style={{ cursor: 'pointer', opacity: selectedIdx === index ? 1 : 0.78 }}
              >
                <td>{asset.symbol}</td>
                <td>{formatPrice(asset)}</td>
                <td className={asset.change >= 0 ? 'up' : 'dn'}>
                  {asset.change >= 0 ? '+' : ''}{asset.change}%
                </td>
                <td>{asset.rsi}</td>
                <td>{asset.trend}</td>
                <td>{asset.macd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
