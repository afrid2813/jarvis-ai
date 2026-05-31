import React from 'react';

function AgentRowBase({ agent, status }) {
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

function SwarmBarBase({ agent, value, index }) {
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

export const AgentRow = React.memo(AgentRowBase);
export const SwarmBar = React.memo(SwarmBarBase);
