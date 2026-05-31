import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Jarvis render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="card">
            <div className="card-title">Jarvis Error</div>
            <p className="no-signal">Something went wrong. Reload the page.</p>
            <button className="send-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
