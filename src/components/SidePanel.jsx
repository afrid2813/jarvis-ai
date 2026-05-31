import React from 'react';
import { formatPrice } from '../utils/assets';
import { AgentRow, SwarmBar } from './AgentSwarmPanel';
import RiskMeter from './RiskMeter';
import SignalBox from './SignalBox';
import TradeJournal from './TradeJournal';

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

export default function SidePanel({
  phase,
  setPhase,
  phaseLabels,
  evolutionState,
  latestTrace,
  agents,
  agentActive,
  swarmData,
  riskLevel,
  asset,
  lastSignal,
  trades,
  assets,
}) {
  return (
    <div className="side-panel">
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

      <EvolutionOSPanel state={evolutionState} latestTrace={latestTrace} />

      <div className="card">
        <div className="card-title">Agent Swarm Status</div>
        {agents.map((a, i) => (
          <AgentRow
            key={a.name}
            agent={a}
            status={i < agentActive ? 'done' : i === agentActive ? 'running' : 'idle'}
          />
        ))}
      </div>

      <div className="card">
        <div className="card-title">Swarm Confidence</div>
        {agents.map((a, i) => (
          <SwarmBar
            key={a.name}
            agent={a}
            index={i}
            value={swarmData ? swarmData[i] : null}
          />
        ))}
      </div>

      <div className="card">
        <div className="card-title">Risk Meter</div>
        <RiskMeter level={riskLevel} />
      </div>

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

      <SignalBox lastSignal={lastSignal} />

      <TradeJournal trades={trades} assets={assets} />
    </div>
  );
}
