import React from 'react';

export default function HeadlinesPanel({ headlines, onRefresh, loading }) {
  return (
    <details className="card" open>
      <summary className="card-title trade-journal-summary">
        <span>News Headlines</span>
        <button
          className="quick-btn"
          onClick={event => {
            event.preventDefault();
            onRefresh();
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </summary>

      {loading ? (
        <div className="no-signal">Refreshing...</div>
      ) : headlines.length ? (
        <div className="evolution-list">
          {headlines.slice(0, 5).map((headline, index) => (
            <div className="evolution-row" key={`${headline.title}-${index}`}>
              <span>• {headline.title}</span>
              <span>{headline.source}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-signal">No headlines</div>
      )}
    </details>
  );
}
