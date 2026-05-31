import React from 'react';

export default function SignalBox({ lastSignal }) {
  return (
    <div className="card">
      <div className="card-title">Last Signal</div>
      {lastSignal ? (
        <div className={`last-signal signal-pill-${{ BUY: 'buy', SELL: 'sell', WAIT: 'wait', HOLD: 'hold' }[lastSignal.action] || 'hold'}`}>
          {{ BUY: '✅', SELL: '❌', WAIT: '⏳', HOLD: '⏸' }[lastSignal.action]} <strong>{lastSignal.action}</strong> on {lastSignal.symbol} · {lastSignal.confidence}% · {lastSignal.risk} risk
        </div>
      ) : (
        <div className="no-signal">No signal yet. Run an analysis.</div>
      )}
    </div>
  );
}
