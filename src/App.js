// src/App.js
import React, { Suspense, lazy, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useAlertChecker } from './hooks/useAlertChecker';
import { useAI } from './hooks/useAI';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMarketData } from './hooks/useMarketData';
import { buildSystemPrompt } from './utils/prompts';
import { ASSETS, AGENTS, loadAlerts, loadWatchlist, saveAlerts, saveWatchlist } from './utils/assets';
import { fetchNewsHeadlines } from './services/marketData';
import { loadEvolutionState, loadTrades, recallBestStrategy, recordTrade, runEvolutionCycle } from './self-evolving-os/selfEvolvingOS';
import TickerCard from './components/TickerCard';
import ChartPanel from './components/ChartPanel';
import ChatPanel from './components/ChatPanel';
import SidePanel from './components/SidePanel';
import './App.css';

const CompareTable = lazy(() => import('./components/CompareTable'));
const selectAssetBySymbol = (assets, symbol) => Math.max(0, assets.findIndex(item => item.symbol === symbol));

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

// ── Main App ─────────────────────────────────
export default function App() {
  const {
    assets,
    marketStatus,
    marketReady,
    hasStaleAssets,
    dismissStale,
    setDismissStale,
    fearAndGreed,
    refreshNow,
  } = useMarketData(ASSETS);
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
  const [headlines, setHeadlines] = useState([]);
  const [headlinesLoading, setHeadlinesLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [alerts, setAlerts] = useState(() => loadAlerts());
  const [watchlist, setWatchlist] = useState(() => loadWatchlist());
  const [evolutionState, setEvolutionState] = useState(() => loadEvolutionState(AGENTS));
  const [latestTrace, setLatestTrace] = useState(null);
  const chatRef = useRef(null);
  const { analyze, provider } = useAI();

  const asset = assets[selectedIdx] || assets[0];
  useAlertChecker({ alerts, assets });
  useKeyboardShortcuts({ assets, compareMode, setCompareMode, setPhase, setSelectedIdx });

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
    return undefined;
  }, []);

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

  const addToWatchlist = useCallback((symbol = asset.symbol) => {
    setWatchlist(prev => {
      if (prev.includes(symbol)) return prev;
      const next = [...prev, symbol].slice(0, 10);
      saveWatchlist(next);
      return next;
    });
  }, [asset.symbol]);

  const removeFromWatchlist = useCallback((symbol) => {
    setWatchlist(prev => {
      const next = prev.filter(item => item !== symbol);
      saveWatchlist(next);
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
        role: err.systemMessage ? 'system' : 'assistant',
        content: err.systemMessage
          ? err.message
          : `**Error:** ${err.message}\n\nJarvis now sends AI requests through \`/api/chat\`. Check that the Vercel/serverless proxy is running and the provider keys are set as server environment variables.`,
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
            <Suspense fallback={<div className="skeleton-card" />}>
              <CompareTable
                assets={assets}
                selectedIdx={selectedIdx}
                onSelect={setSelectedIdx}
              />
            </Suspense>
          )}

          {/* Main layout */}
          <div className="main-grid">

            <div className="main-column">
              <ChartPanel asset={asset} />

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
              watchlist={watchlist}
              addToWatchlist={addToWatchlist}
              removeFromWatchlist={removeFromWatchlist}
              selectAsset={symbol => setSelectedIdx(selectAssetBySymbol(assets, symbol))}
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
