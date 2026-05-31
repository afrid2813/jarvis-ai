import React, { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../utils/assets';

function toTradingViewSymbol(symbol) {
  const map = {
    'BTC/USD': 'COINBASE:BTCUSD',
    'ETH/USD': 'COINBASE:ETHUSD',
    'SOL/USD': 'COINBASE:SOLUSD',
    SPY: 'AMEX:SPY',
    AAPL: 'NASDAQ:AAPL',
    'EUR/USD': 'FX:EURUSD',
    GLD: 'AMEX:GLD',
  };

  return map[symbol] || symbol.replace('/', '');
}

function getTradingViewDataStatus(asset) {
  if (asset.market === 'crypto' || asset.market === 'forex') {
    return { label: 'Realtime feed', tone: 'live' };
  }

  return { label: 'Exchange may delay', tone: 'delay' };
}

function buildChartPoints(asset) {
  const candles = Array.isArray(asset.candles) && asset.candles.length > 2
    ? asset.candles.slice(-48).map(candle => candle.close).filter(Boolean)
    : [];

  if (candles.length > 2) return candles;

  const start = asset.price / (1 + (asset.change || 0) / 100);
  return Array.from({ length: 32 }, (_, index) => {
    const progress = index / 31;
    const wave = Math.sin(index * 0.75) * asset.price * 0.004;
    return start + (asset.price - start) * progress + wave;
  });
}

function LocalChart({ asset }) {
  const prices = buildChartPoints(asset);
  const support = Number(asset.support);
  const resistance = Number(asset.resistance);
  const chartValues = [
    ...prices,
    ...(Number.isFinite(support) ? [support] : []),
    ...(Number.isFinite(resistance) ? [resistance] : []),
  ];
  const min = Math.min(...chartValues);
  const max = Math.max(...chartValues);
  const range = max - min || 1;
  const priceToY = price => 100 - ((price - min) / range) * 100;
  const points = prices
    .map((price, index) => {
      const x = (index / Math.max(prices.length - 1, 1)) * 100;
      const y = priceToY(price);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const up = prices[prices.length - 1] >= prices[0];

  return (
    <div className="local-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`chartFill-${asset.symbol.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? '#7bc44a' : '#e07070'} stopOpacity="0.32" />
            <stop offset="100%" stopColor={up ? '#7bc44a' : '#e07070'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,100 ${points} 100,100`}
          fill={`url(#chartFill-${asset.symbol.replace(/\W/g, '')})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke={up ? '#7bc44a' : '#e07070'}
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        {Number.isFinite(support) && (
          <g>
            <line
              x1="0"
              x2="100"
              y1={priceToY(support)}
              y2={priceToY(support)}
              stroke="#7bc44a"
              strokeDasharray="3 3"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x="97" y={priceToY(support) - 2} fill="#7bc44a" fontSize="7" textAnchor="end">S</text>
          </g>
        )}
        {Number.isFinite(resistance) && (
          <g>
            <line
              x1="0"
              x2="100"
              y1={priceToY(resistance)}
              y2={priceToY(resistance)}
              stroke="#e07070"
              strokeDasharray="3 3"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x="97" y={priceToY(resistance) - 2} fill="#e07070" fontSize="7" textAnchor="end">R</text>
          </g>
        )}
      </svg>
      <div className="local-chart-overlay">
        <div>
          <span className="chart-kicker">{asset.symbol}</span>
          <strong>{formatPrice(asset)}</strong>
        </div>
        <span className={up ? 'up' : 'dn'}>{up ? '+' : ''}{asset.change}%</span>
      </div>
    </div>
  );
}

export default function ChartPanel({ asset }) {
  const containerRef = useRef(null);
  const [chartMode, setChartMode] = useState('local');
  const [blocked, setBlocked] = useState(false);
  const tradingViewSymbol = toTradingViewSymbol(asset.symbol);
  const dataStatus = getTradingViewDataStatus(asset);

  useEffect(() => {
    if (!containerRef.current) return;
    if (chartMode !== 'tradingview') return;

    containerRef.current.innerHTML = '';
    setBlocked(false);

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.onerror = () => {
      setBlocked(true);
      setChartMode('local');
    };
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tradingViewSymbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: false,
      support_host: 'https://www.tradingview.com',
      backgroundColor: '#18181c',
      gridColor: 'rgba(255, 255, 255, 0.06)',
    });

    containerRef.current.appendChild(widget);
    containerRef.current.appendChild(script);
  }, [chartMode, tradingViewSymbol]);

  return (
    <div className="chart-panel">
      <div className="panel-header">
        <div className="panel-title">
          Market Chart
          <span className="phase-pill chart-pill">{chartMode === 'tradingview' ? tradingViewSymbol : 'LOCAL'}</span>
          <span className={`phase-pill data-pill ${dataStatus.tone}`}>{dataStatus.label}</span>
        </div>
        <div className="chart-controls">
          <button
            className={`chart-toggle ${chartMode === 'local' ? 'active' : ''}`}
            onClick={() => setChartMode('local')}
          >
            Local
          </button>
          <button
            className={`chart-toggle ${chartMode === 'tradingview' ? 'active' : ''}`}
            onClick={() => setChartMode('tradingview')}
          >
            TV
          </button>
        </div>
      </div>
      {chartMode === 'tradingview' ? (
        <div className="tradingview-widget-container" ref={containerRef} />
      ) : (
        <div className="chart-surface">
          <LocalChart asset={asset} />
          {blocked && <div className="chart-blocked">TradingView blocked</div>}
        </div>
      )}
    </div>
  );
}
