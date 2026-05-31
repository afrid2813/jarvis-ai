// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import { useAI } from './hooks/useAI';
import { buildSystemPrompt } from './utils/prompts';
import { ASSETS, AGENTS, formatPrice } from './utils/assets';
import { fetchAllMarketData } from './services/marketData';
import { loadEvolutionState, recallBestStrategy, runEvolutionCycle } from './self-evolving-os/selfEvolvingOS';
import './App.css';

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

function TickerCard({ asset, selected, onClick }) {
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

function AgentRow({ agent, status }) {
  // status: 'idle' | 'running' | 'done'
  return (
    <div className="agent-row">
      <div className="agent-left">
        <div className={`agent-dot ${status}`} />
        <span className="agent-icon">{agent.icon}</span>
        <span className="agent-name">{agent.name}</span>
      </div>
      <span className={`agent-status ${status}`}>
        {status === 'done' ? '✓ done' : status === 'running' ? 'running' : 'idle'}
      </span>
    </div>
  );
}

function SwarmBar({ agent, value, index }) {
  const colors = ['#185FA5','#3B6D11','#993C1D','#854F0B','#A32D2D','#0F6E56','#534AB7'];
  return (
    <div className="swarm-row">
      <span className="swarm-label">{agent.name.replace(' Agent', '')}</span>
      <div className="swarm-track">
        <div
          className="swarm-fill"
          style={{ width: `${value || 0}%`, background: colors[index] }}
        />
      </div>
      <span className="swarm-val">{value != null ? `${value}%` : '—'}</span>
    </div>
  );
}

function RiskMeter({ level }) {
  const map = {
    LOW:    { width: '22%', color: '#3B6D11', label: 'Low' },
    MEDIUM: { width: '55%', color: '#854F0B', label: 'Medium' },
    HIGH:   { width: '88%', color: '#A32D2D', label: 'High' },
  };
  const r = level ? map[level] || map.MEDIUM : { width: '0%', color: '#5a5a5a', label: '—' };
  return (
    <div className="risk-meter">
      <div className="risk-header">
        <span>Capital Risk</span>
        <span className="risk-label" style={{ color: r.color }}>{r.label || '—'}</span>
      </div>
      <div className="risk-track">
        <div className="risk-bar" style={{ width: r.width, background: r.color }} />
      </div>
      <div className="risk-scale">
        <span>Low</span><span>Medium</span><span>High</span>
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isUser) {
    return <div className="msg msg-user">{msg.content}</div>;
  }
  if (isSystem) {
    return (
      <div className="msg msg-system">
        <strong>Jarvis online.</strong> {msg.content}
      </div>
    );
  }

  const signal = msg.signal;
  const signalClass = signal
    ? { BUY: 'sig-buy', SELL: 'sig-sell', WAIT: 'sig-wait', HOLD: 'sig-hold' }[signal.action] || 'sig-hold'
    : '';
  const signalIcon = signal
    ? { BUY: '✅', SELL: '❌', WAIT: '⏳', HOLD: '⏸' }[signal.action] || '📊'
    : '';

  return (
    <div className="msg msg-ai">
      <div className="msg-tag">{msg.tag || 'Jarvis'}</div>
      <div
        className="msg-body"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
      />
      {signal && (
        <div className={`signal-box ${signalClass}`}>
          {signalIcon} {signal.action} · {signal.confidence}% confidence · {signal.risk} risk
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text) {
  return escapeHtml(text)
    .replace(/^## (.+)$/gm, '<div class="md-h2">$1</div>')
    .replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatUpdateTime(value) {
  if (!value) return 'Static snapshot';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toTradingViewSymbol(symbol) {
  const map = {
    'BTC/USD': 'COINBASE:BTCUSD',
    'ETH/USD': 'COINBASE:ETHUSD',
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

function EvolutionOSPanel({ state, latestTrace }) {
  const topAgents = Object.entries(state.agentScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const latestReflection = state.reflections[0];
  const pluginCandidate = state.pluginCandidates[state.pluginCandidates.length - 1];

  return (
    <div className="card evolution-card">
      <div className="card-title">Self-Evolving OS</div>
      <div className="evolution-grid">
        <div className="evolution-stat">
          <span>Tasks</span>
          <strong>{state.metrics.taskCount}</strong>
        </div>
        <div className="evolution-stat">
          <span>Success</span>
          <strong>{Math.round(state.metrics.successRate * 100)}%</strong>
        </div>
        <div className="evolution-stat">
          <span>Latency</span>
          <strong>{state.metrics.averageLatencyMs ? `${Math.round(state.metrics.averageLatencyMs / 1000)}s` : '—'}</strong>
        </div>
        <div className="evolution-stat">
          <span>Topology</span>
          <strong>{latestTrace?.topology || 'idle'}</strong>
        </div>
      </div>
      <div className="evolution-list">
        {topAgents.map(([name, score]) => (
          <div className="evolution-row" key={name}>
            <span>{name.replace(' Agent', '')}</span>
            <span>{Math.round(score * 100)}%</span>
          </div>
        ))}
      </div>
      {latestReflection && (
        <div className="evolution-note">
          <strong>Reflection:</strong> {latestReflection.fix}
        </div>
      )}
      {pluginCandidate && (
        <div className="evolution-note plugin">
          <strong>Plugin candidate:</strong> {pluginCandidate.name}
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
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: 'Ruflo multi-agent swarm ready. Select an asset, choose your mode, and ask anything.',
    },
  ]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentActive, setAgentActive] = useState(-1);
  const [swarmData, setSwarmData] = useState(null);
  const [riskLevel, setRiskLevel] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [marketStatus, setMarketStatus] = useState({ state: 'idle', updatedAt: null, error: null });
  const [evolutionState, setEvolutionState] = useState(() => loadEvolutionState(AGENTS));
  const [latestTrace, setLatestTrace] = useState(null);
  const chatRef = useRef(null);
  const assetsRef = useRef(ASSETS);
  const { analyze, provider } = useAI();

  const asset = assets[selectedIdx] || assets[0];

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    let cancelled = false;

    async function refreshMarketData(silent = false) {
      if (!silent) setMarketStatus(prev => ({ ...prev, state: 'loading', error: null }));

      try {
        const nextAssets = await fetchAllMarketData(assetsRef.current);
        if (cancelled) return;

        setAssets(nextAssets);
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
  }, []);

  async function refreshNow() {
    setMarketStatus(prev => ({ ...prev, state: 'loading', error: null }));
    try {
      const nextAssets = await fetchAllMarketData(assets);
      setAssets(nextAssets);
      setMarketStatus({
        state: nextAssets.some(nextAsset => nextAsset.stale) ? 'warning' : 'ready',
        updatedAt: new Date().toISOString(),
        error: nextAssets.filter(nextAsset => nextAsset.stale).map(nextAsset => `${nextAsset.symbol}: ${nextAsset.staleReason || 'stale'}`).join(' · ') || null,
      });
    } catch (err) {
      setMarketStatus(prev => ({ ...prev, state: 'error', error: err.message }));
    }
  }

  const quickButtons = {
    1: ['What is ' + asset.symbol.split('/')[0] + '?', 'How does RSI work?', 'What is a stop loss?', 'Explain crypto basics'],
    2: ['Analyze ' + asset.symbol, 'Is RSI overbought?', 'EMA trend check', 'MACD signal?'],
    3: ['Full swarm analysis on ' + asset.symbol, 'Multi-factor risk report', 'Entry + exit strategy', 'Fear/greed + technicals'],
  };

  async function send(text) {
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
      const systemPrompt = buildSystemPrompt(asset, phase);
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
      }

      const aiMsg = {
        role: 'assistant',
        content,
        signal,
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
        content: `**Error:** ${err.message}\n\nIf using Ollama, make sure it is running: open a terminal and run \`ollama serve\``,
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
  }

  const phaseLabels = { 1: '🟢 Beginner', 2: '🟡 Analyst', 3: '🔴 Hedge Fund' };
  const marketBadge = marketStatus.state === 'loading'
    ? 'Refreshing market data'
    : marketStatus.state === 'error'
      ? 'Market data fallback'
      : marketStatus.state === 'warning'
        ? 'Some feeds stale'
        : `Updated ${formatUpdateTime(marketStatus.updatedAt)}`;

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

      {/* Tickers */}
      <div className="tickers">
        {assets.map((a, i) => (
          <TickerCard
            key={a.symbol}
            asset={a}
            selected={i === selectedIdx}
            onClick={() => setSelectedIdx(i)}
          />
        ))}
      </div>

      {/* Main layout */}
      <div className="main-grid">

        <div className="main-column">
          <TradingViewChart asset={asset} />

          {/* Chat panel */}
          <div className="chat-panel">
            <div className="panel-header">
              <div className="panel-title">
                ⚡ Swarm Intelligence Engine
                <span className={`phase-pill phase-${phase}`}>
                  Phase {phase}
                </span>
              </div>
              <span className="asset-label">{asset.symbol}</span>
            </div>

            <div className="chat-area" ref={chatRef}>
              {messages.map((m, i) => <Message key={i} msg={m} />)}
              {loading && (
                <div className="msg msg-ai">
                  <div className="msg-tag">
                    Jarvis · {phase === 3 ? 'Running 7 agents' : 'Thinking'}...
                  </div>
                  <div className="loading-dots">
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </div>

            <div className="quick-row">
              {(quickButtons[phase] || []).map(q => (
                <button key={q} className="quick-btn" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>

            <div className="input-row">
              <textarea
                className="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask anything — beginner question, trade analysis, or full hedge fund breakdown..."
                rows={1}
              />
              <button className="send-btn" onClick={() => send()} disabled={loading}>
                {loading ? '...' : 'Run ↗'}
              </button>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="side-panel">

          {/* Mode selector */}
          <div className="card">
            <div className="card-title">Intelligence Mode</div>
            <div className="phase-row">
              {[1, 2, 3].map(p => (
                <button
                  key={p}
                  className={`phase-btn ${phase === p ? `phase-btn-${p}` : ''}`}
                  onClick={() => setPhase(p)}
                >
                  {phaseLabels[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Agent swarm */}
          <EvolutionOSPanel state={evolutionState} latestTrace={latestTrace} />

          <div className="card">
            <div className="card-title">Agent Swarm Status</div>
            {AGENTS.map((a, i) => (
              <AgentRow
                key={a.name}
                agent={a}
                status={i < agentActive ? 'done' : i === agentActive ? 'running' : 'idle'}
              />
            ))}
          </div>

          {/* Swarm confidence */}
          <div className="card">
            <div className="card-title">Swarm Confidence</div>
            {AGENTS.map((a, i) => (
              <SwarmBar
                key={a.name}
                agent={a}
                index={i}
                value={swarmData ? swarmData[i] : null}
              />
            ))}
          </div>

          {/* Risk meter */}
          <div className="card">
            <div className="card-title">Risk Meter</div>
            <RiskMeter level={riskLevel} />
          </div>

          {/* Asset metrics */}
          <div className="card">
            <div className="card-title">Asset Metrics</div>
            <div className="metrics-grid">
              <div className="metric">
                <div className="metric-label">RSI</div>
                <div className="metric-val" style={{
                  color: asset.rsi > 70 ? '#A32D2D' : asset.rsi < 30 ? '#3B6D11' : 'inherit'
                }}>{asset.rsi}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Trend</div>
                <div className="metric-val" style={{
                  color: asset.trend === 'Bullish' ? '#3B6D11' : asset.trend === 'Bearish' ? '#A32D2D' : 'inherit',
                  fontSize: '13px'
                }}>{asset.trend}</div>
              </div>
              <div className="metric">
                <div className="metric-label">MACD</div>
                <div className="metric-val" style={{
                  color: asset.macd === 'Positive' ? '#3B6D11' : asset.macd === 'Negative' ? '#A32D2D' : 'inherit',
                  fontSize: '12px'
                }}>{asset.macd}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Volume</div>
                <div className="metric-val" style={{ fontSize: '12px' }}>{asset.volume}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Support</div>
                <div className="metric-val" style={{ fontSize: '12px' }}>{asset.support ? formatPrice({ price: asset.support }) : '—'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Resistance</div>
                <div className="metric-val" style={{ fontSize: '12px' }}>{asset.resistance ? formatPrice({ price: asset.resistance }) : '—'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Candles</div>
                <div className="metric-val" style={{ fontSize: '12px' }}>{asset.candles?.length || 0} · {asset.candleInterval || '—'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Source</div>
                <div className="metric-val" style={{ fontSize: '11px' }}>{asset.dataSource || 'fallback'}</div>
              </div>
            </div>
          </div>

          {/* Last signal */}
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

        </div>
      </div>

      <div className="disclaimer">
        ⚠ Paper trading simulation only · Not financial advice · Never risk capital you cannot afford to lose
      </div>
    </div>
  );
}
