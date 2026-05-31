import React from 'react';

export default function RiskMeter({ level }) {
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
