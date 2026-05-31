// src/App.js
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useAI } from './hooks/useAI';
import { buildSystemPrompt } from './utils/prompts';
import { ASSETS, AGENTS, formatPrice, loadAlerts, saveAlerts } from './utils/assets';
import { fetchAllMarketData, fetchFearAndGreed, fetchNewsHeadlines } from './services/marketData';
import { loadEvolutionState, loadTrades, recallBestStrategy, recordTrade, runEvolutionCycle } from './self-evolving-os/selfEvolvingOS';
import TickerCard from './components/TickerCard';
import ChatPanel from './components/ChatPanel';
import CompareTable from './components/CompareTable';
import SidePanel from './components/SidePanel';
import './App.css';

const defaultSystemMsg = {
  role: 'system',
  content: 'Ruflo multi-agent swarm ready. Select an asset, choose your mode, and ask anything.',
};

// ── Signal extractor ─────────────────────────
function extractSignal(text) {
  const match = text.match(/<signal>(.*?)<\/signal>/s);
  if (!match) return null;
  try { return normalizeSignal(JSON.parse(match[1])); } catch { return null; }
}

function cleanText(text) {
  return text.replace(/<signal>.*?<\/signal>/s, '').trim();
}

function normalizeSignal(signal) {
  const actions = ['BUY', 'SELL', 'HOLD', 'WAIT'];
  const risks = ['LOW', 'MEDIUM', 'HIGH'];
  const action = actions.includes(signal.action) ? signal.action : 'HOLD';
  const risk = risks.includes(signal.risk) ? signal.risk : 'MEDIUM';
  const confidence = Math.max(0, Math.min(100, Number(signal.confidence) || 0));
  const swarm = Array.isArray(signal.swarm)
    ? signal.swarm.slice(0, AGENTS.length).map(value => Math.max(0, Math.min(100, Number(value) || 0)))
    : null;

  return {
    ...signal,
    action,
    risk,
    confidence,
    swarm: swarm && swarm.length === AGENTS.length ? swarm : null,
  };
}

// ── Sub-components ───────────────────────────

function formatUpdateTime(value) {
  if (!value) return 'Static snapshot';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices
    .map((price, index) => {
      const x = (index / Math.max(prices.length - 1, 1)) * 100;
      const y = 100 - ((price - min) / range) * 100;
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

function TradingViewChart({ asset }) {
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

// ── Main App ─────────────────────────────────
export default function App() {
  const [assets, setAssets] = useState(ASSETS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [phase, setPhase] = useState(2);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('jarvis.chat.v1'));
      return Array.isArray(saved) && saved.length ? saved : [defaultSystemMsg];
    } catch {
      return [defaultSystemMsg];
    }
  });
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentActive, setAgentActive] = useState(-1);
  const [swarmData, setSwarmData] = useState(null);
  const [riskLevel, setRiskLevel] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [trades, setTrades] = useState(() => loadTrades());
  const [fearAndGreed, setFearAndGreed] = useState(null);
  const [headlines, setHeadlines] = useState([]);
  const [headlinesLoading, setHeadlinesLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [alerts, setAlerts] = useState(() => loadAlerts());
  const [dismissStale, setDismissStale] = useState(false);
  const [marketReady, setMarketReady] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ state: 'idle', updatedAt: null, error: null });
  const [evolutionState, setEvolutionState] = useState(() => loadEvolutionState(AGENTS));
  const [latestTrace, setLatestTrace] = useState(null);
  const chatRef = useRef(null);
  const assetsRef = useRef(ASSETS);
  const triggeredAlertsRef = useRef(new Set());
  const { analyze, provider } = useAI();

  const asset = assets[selectedIdx] || assets[0];
  const hasStaleAssets = assets.some(item => item.stale);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    try {
      sessionStorage.setItem('jarvis.chat.v1', JSON.stringify(messages.slice(-40)));
    } catch {
      // Session storage can be unavailable; chat still works in memory.
    }
  }, [messages]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    alerts.forEach((alert, index) => {
      const currentAsset = assets.find(item => item.symbol === alert.symbol);
      const currentPrice = Number(currentAsset?.price);
      const threshold = Number(alert.price);
      const triggered = alert.direction === 'above'
        ? currentPrice >= threshold
        : currentPrice <= threshold;
      const key = `${index}:${alert.symbol}:${alert.direction}:${alert.price}`;

      if (Number.isFinite(currentPrice) && Number.isFinite(threshold) && triggered && !triggeredAlertsRef.current.has(key)) {
        triggeredAlertsRef.current.add(key);
        console.log('Alert triggered:', alert);
      } else if (!triggered) {
        triggeredAlertsRef.current.delete(key);
      }
    });
  }, [assets, alerts]);

  const refreshHeadlines = useCallback(async (symbol = asset.symbol) => {
    setHeadlinesLoading(true);
    try {
      const result = await fetchNewsHeadlines(symbol);
      setHeadlines(result || []);
    } finally {
      setHeadlinesLoading(false);
    }
  }, [asset.symbol]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHeadlines(asset.symbol);
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedIdx, asset.symbol, refreshHeadlines]);

  useEffect(() => {
    function handleKeydown(event) {
      const target = event.target;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if (isTyping) return;

      if (event.key === 'c') {
        setCompareMode(value => !value);
      } else if (event.key === 'Escape' && compareMode) {
        setCompareMode(false);
      } else if (['1', '2', '3'].includes(event.key)) {
        setPhase(Number(event.key));
      } else if (event.key === 'ArrowLeft') {
        setSelectedIdx(index => (index - 1 + assets.length) % assets.length);
      } else if (event.key === 'ArrowRight') {
        setSelectedIdx(index => (index + 1) % assets.length);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [assets.length, compareMode]);

  useEffect(() => {
    let cancelled = false;

    async function refreshMarketData(silent = false) {
      if (!silent) setMarketStatus(prev => ({ ...prev, state: 'loading', error: null }));

      try {
        const [nextAssets, nextFearAndGreed] = await Promise.all([
          fetchAllMarketData(assetsRef.current),
          fetchFearAndGreed(),
        ]);
        if (cancelled) return;

        setAssets(nextAssets);
        setFearAndGreed(nextFearAndGreed);
        refreshHeadlines((nextAssets[selectedIdx] || nextAssets[0]).symbol);
        setDismissStale(false);
        setMarketReady(true);
        setMarketStatus({
          state: nextAssets.some(nextAsset => nextAsset.stale) ? 'warning' : 'ready',
          updatedAt: new Date().toISOString(),
          error: nextAssets.filter(nextAsset => nextAsset.stale).map(nextAsset => `${nextAsset.symbol}: ${nextAsset.staleReason || 'stale'}`).join(' · ') || null,
        });
      } catch (err) {
        if (cancelled) return;
        setMarketStatus(prev => ({ ...prev, state: 'error', error: err.message }));
      }
    }

    refreshMarketData();
    const refreshId = setInterval(() => refreshMarketData(true), 60_000);

    return () => {
      cancelled = true;
      clearInterval(refreshId);
    };
  }, [refreshHeadlines, selectedIdx]);

  const refreshNow = useCallback(async () => {
    setMarketStatus(prev => ({ ...prev, state: 'loading', error: null }));
    try {
      const [nextAssets, nextFearAndGreed] = await Promise.all([
        fetchAllMarketData(assets),
        fetchFearAndGreed(),
      ]);
      setAssets(nextAssets);
      setFearAndGreed(nextFearAndGreed);
      refreshHeadlines((nextAssets[selectedIdx] || nextAssets[0]).symbol);
      setDismissStale(false);
      setMarketReady(true);
      setMarketStatus({
        state: nextAssets.some(nextAsset => nextAsset.stale) ? 'warning' : 'ready',
        updatedAt: new Date().toISOString(),
        error: nextAssets.filter(nextAsset => nextAsset.stale).map(nextAsset => `${nextAsset.symbol}: ${nextAsset.staleReason || 'stale'}`).join(' · ') || null,
      });
    } catch (err) {
      setMarketStatus(prev => ({ ...prev, state: 'error', error: err.message }));
    }
  }, [assets, refreshHeadlines, selectedIdx]);

  const clearChat = useCallback(() => {
    setMessages([defaultSystemMsg]);
    try {
      sessionStorage.removeItem('jarvis.chat.v1');
    } catch {
      // Ignore storage failures; the in-memory chat is cleared above.
    }
  }, []);

  const addAlert = useCallback((alert) => {
    setAlerts(prev => {
      const next = [...prev, alert];
      saveAlerts(next);
      return next;
    });
  }, []);

  const removeAlert = useCallback((index) => {
    setAlerts(prev => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      saveAlerts(next);
      return next;
    });
  }, []);

  const quickButtons = {
    1: ['What is ' + asset.symbol.split('/')[0] + '?', 'How does RSI work?', 'What is a stop loss?', 'Explain crypto basics'],
    2: ['Analyze ' + asset.symbol, 'Is RSI overbought?', 'EMA trend check', 'MACD signal?'],
    3: ['Full swarm analysis on ' + asset.symbol, 'Multi-factor risk report', 'Entry + exit strategy', 'Fear/greed + technicals'],
  };

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);

    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    const newHistory = [...history, { role: 'user', content: msg }];
    const startedAt = Date.now();
    const recalledStrategy = recallBestStrategy(evolutionState, msg, phase);

    // Animate agents in Phase 3
    let agentTimer = null;
    if (phase === 3) {
      let i = 0;
      agentTimer = setInterval(() => {
        setAgentActive(i++);
        if (i >= AGENTS.length) clearInterval(agentTimer);
      }, 600);
    }

    try {
      const systemPrompt = buildSystemPrompt(asset, phase, fearAndGreed, headlines);
      const promptWithMemory = recalledStrategy
        ? `${systemPrompt}\n\nBEST PAST STRATEGY RECALL:\nTask type: ${recalledStrategy.taskType}\nTopology: ${recalledStrategy.topology}\nWinning agents: ${recalledStrategy.selectedAgents.join(', ')}\nPrior action: ${recalledStrategy.action}\nPrior confidence: ${recalledStrategy.confidence}%`
        : systemPrompt;
      const raw = await analyze(newHistory.slice(-10), promptWithMemory);

      const signal = extractSignal(raw);
      const content = cleanText(raw);
      const modeTag = ['Beginner', 'Analyst', 'Hedge Fund'][phase - 1];

      if (signal) {
        setRiskLevel(signal.risk || 'MEDIUM');
        if (signal.swarm) setSwarmData(signal.swarm);
        setLastSignal({ ...signal, symbol: asset.symbol });
        recordTrade({
          symbol: asset.symbol,
          action: signal.action,
          confidence: signal.confidence,
          risk: signal.risk,
          price: asset.price,
          timestamp: new Date().toISOString(),
        });
        setTrades(loadTrades());
      }

      const aiMsg = {
        role: 'assistant',
        content,
        signal,
        symbol: asset.symbol,
        timestamp: new Date().toISOString(),
        tag: `Jarvis · ${modeTag} Mode`,
      };

      setMessages(prev => [...prev, aiMsg]);
      setHistory([...newHistory, { role: 'assistant', content: raw }]);

      const cycle = runEvolutionCycle({
        state: evolutionState,
        task: msg,
        asset,
        phase,
        signal,
        startedAt,
        endedAt: Date.now(),
        agents: AGENTS,
      });
      setEvolutionState(cycle.state);
      setLatestTrace(cycle.trace);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Error:** ${err.message}\n\nJarvis now sends AI requests through \`/api/chat\`. Check that the Vercel/serverless proxy is running and the provider keys are set as server environment variables.`,
        tag: 'Jarvis · Error',
      }]);

      const cycle = runEvolutionCycle({
        state: evolutionState,
        task: msg,
        asset,
        phase,
        error: err,
        startedAt,
        endedAt: Date.now(),
        agents: AGENTS,
      });
      setEvolutionState(cycle.state);
      setLatestTrace(cycle.trace);
    }

    if (agentTimer) clearInterval(agentTimer);
    setAgentActive(-1);
    setLoading(false);
  }, [analyze, asset, evolutionState, fearAndGreed, headlines, history, input, loading, phase]);

  const phaseLabels = { 1: '🟢 Beginner', 2: '🟡 Analyst', 3: '🔴 Hedge Fund' };
  const marketBadge = marketStatus.state === 'loading'
    ? 'Refreshing market data'
    : marketStatus.state === 'error'
      ? 'Market data fallback'
      : marketStatus.state === 'warning'
        ? 'Some feeds stale'
        : `Updated ${formatUpdateTime(marketStatus.updatedAt)}`;
  const tickerCards = useMemo(() => assets.map((a, i) => (
    <TickerCard
      key={a.symbol}
      asset={a}
      selected={i === selectedIdx}
      onClick={() => setSelectedIdx(i)}
    />
  )), [assets, selectedIdx]);
  const refreshSelectedHeadlines = useCallback(() => {
    refreshHeadlines(asset.symbol);
  }, [asset.symbol, refreshHeadlines]);

  return (
    <div className="app">
      {/* Header */}
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

      {hasStaleAssets && !dismissStale && (
        <div className="stale-banner">
          <span>⚠ Some market data is stale — prices may not reflect current market.</span>
          <button className="quick-btn" onClick={() => setDismissStale(true)}>Dismiss</button>
        </div>
      )}

      {!marketReady ? (
        <div className="skeleton-wrap">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      ) : (
        <>
          {/* Tickers */}
          <div className="tickers">
            {tickerCards}
          </div>

          {compareMode && (
            <CompareTable
              assets={assets}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
          )}

          {/* Main layout */}
          <div className="main-grid">

            <div className="main-column">
              <TradingViewChart asset={asset} />

              <ChatPanel
                asset={asset}
                phase={phase}
                messages={messages}
                loading={loading}
                quickButtons={quickButtons}
                input={input}
                setInput={setInput}
                send={send}
                chatRef={chatRef}
                clearChat={clearChat}
              />
            </div>

            <SidePanel
              phase={phase}
              setPhase={setPhase}
              phaseLabels={phaseLabels}
              evolutionState={evolutionState}
              latestTrace={latestTrace}
              agents={AGENTS}
              agentActive={agentActive}
              swarmData={swarmData}
              riskLevel={riskLevel}
              asset={asset}
              lastSignal={lastSignal}
              trades={trades}
              assets={assets}
              headlines={headlines}
              refreshHeadlines={refreshSelectedHeadlines}
              headlinesLoading={headlinesLoading}
              alerts={alerts}
              addAlert={addAlert}
              removeAlert={removeAlert}
              fearAndGreed={fearAndGreed}
            />
          </div>
        </>
      )}

      <div className="disclaimer">
        ⚠ Paper trading simulation only · Not financial advice · Never risk capital you cannot afford to lose
      </div>
      <div className="kbd-legend">C — compare · 1/2/3 — mode · ← → — asset · Esc — close</div>
    </div>
  );
}
