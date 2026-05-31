import React from 'react';
import { formatPrice } from '../utils/assets';

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCurrentAsset(assets, symbol) {
  return assets.find(asset => asset.symbol === symbol);
}

function calculatePnl(trade, assets) {
  if (trade.action !== 'BUY') return null;
  const entryPrice = Number(trade.price);
  const currentPrice = Number(getCurrentAsset(assets, trade.symbol)?.price);
  if (!entryPrice || !currentPrice) return null;

  return ((currentPrice - entryPrice) / entryPrice) * 100;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(trades) {
  const rows = [
    ['Time', 'Asset', 'Action', 'Confidence', 'Risk', 'Entry Price'],
    ...trades.map(trade => [
      trade.timestamp || '',
      trade.symbol || '',
      trade.action || '',
      trade.confidence ?? '',
      trade.risk || '',
      trade.price ?? '',
    ]),
  ];
  const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `jarvis-trades-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TradeJournal({ trades, assets }) {
  const buyTrades = trades.filter(trade => trade.action === 'BUY');
  const wins = buyTrades.filter(trade => {
    const pnl = calculatePnl(trade, assets);
    return pnl != null && pnl > 0;
  }).length;
  const winRate = buyTrades.length ? Math.round((wins / buyTrades.length) * 100) : 0;

  return (
    <details className="card trade-journal-card" open>
      <summary className="card-title trade-journal-summary">Trade Journal</summary>

      {!trades.length ? (
        <div className="no-signal">No signals recorded yet.</div>
      ) : (
        <>
          <div className="trade-table-wrap">
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Asset</th>
                  <th>Action</th>
                  <th>Confidence</th>
                  <th>Risk</th>
                  <th>Entry Price</th>
                  <th>Current Price</th>
                  <th>P&amp;L %</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, index) => {
                  const currentAsset = getCurrentAsset(assets, trade.symbol);
                  const pnl = calculatePnl(trade, assets);

                  return (
                    <tr key={`${trade.timestamp}-${trade.symbol}-${index}`}>
                      <td>{formatTime(trade.timestamp)}</td>
                      <td>{trade.symbol}</td>
                      <td>{trade.action}</td>
                      <td>{Number(trade.confidence) || 0}%</td>
                      <td>{trade.risk || '—'}</td>
                      <td>{formatPrice({ price: Number(trade.price) || 0 })}</td>
                      <td>{currentAsset ? formatPrice(currentAsset) : '—'}</td>
                      <td className={pnl == null ? '' : pnl >= 0 ? 'up' : 'dn'}>
                        {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="trade-summary">
            <span>Total signals: {trades.length}</span>
            <span>Win rate: {winRate}%</span>
            <button className="quick-btn" onClick={() => exportCsv(trades)}>
              Export CSV
            </button>
            <button className="quick-btn" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </>
      )}
    </details>
  );
}
