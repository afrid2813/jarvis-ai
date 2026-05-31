import React from 'react';

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

export default function ChatPanel({
  asset,
  phase,
  messages,
  loading,
  quickButtons,
  input,
  setInput,
  send,
  chatRef,
}) {
  return (
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
  );
}
