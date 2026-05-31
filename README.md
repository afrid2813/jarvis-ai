# Jarvis AI v1.6 — Hedge Fund Intelligence Engine

Jarvis AI is a React + Vercel paper-trading intelligence app with live market data, technical indicators, multi-phase AI analysis, and a self-evolving agent workflow.

---

## Features

- Live market data from Binance public crypto feeds, Yahoo Finance chart data, and EUR/USD exchange rates
- Real RSI, MACD, EMA, Bollinger Bands, and Stoch RSI indicators
- ADX and OBV production indicators
- Candle snapshot summaries with volume profile context
- 3-phase AI analysis: Beginner, Analyst, and Hedge Fund
- Multi-agent swarm analysis in Phase 3
- Self-Evolving OS with local strategy traces and agent scoring
- Fear & Greed index
- News Agent headlines through a server-side NewsAPI proxy
- Trade journal with P&L tracking and CSV export
- Price Alerts with local persistence
- Watchlist with local persistence
- Compare mode for multi-asset scanning
- Keyboard Shortcuts for compare, mode switching, and asset cycling
- Stale Data Banner for degraded market feeds
- Analysis Summary Export as a plain-text report
- Vercel serverless AI proxy so provider keys stay off the browser bundle

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example file:

```bash
cp .env.example .env.local
```

For local React development, keep client mode as proxy:

```bash
REACT_APP_AI_PROVIDER=proxy
ALLOWED_ORIGIN=http://localhost:3000
```

AI provider and NewsAPI secrets must be configured as server environment variables on Vercel, not as `REACT_APP_*` client variables.

### 3. Run Locally

```bash
npm start
```

Open http://localhost:3000.

`npm start` runs a local Jarvis proxy so `/api/chat` and `/api/news` work on `http://localhost:3000` without exposing keys in the browser. Use `npm run start:react` only when you want the React UI without API routes, or `npm run start:vercel` when you specifically want Vercel Dev.

For local AI replies, create `.env.local` from `.env.example` and add server-side values like `AI_PROVIDER=groq` and `GROQ_KEY=...`. Never use `REACT_APP_` for secret keys.

### 4. Deploy To Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the server environment variables listed below.
4. Deploy.

The React app calls `/api/chat` for AI and `/api/news` for headlines; Vercel runs both as protected serverless proxies.

---

## Environment Variables

### Client

```bash
REACT_APP_AI_PROVIDER=proxy
```

### Server / Vercel

```bash
ALLOWED_ORIGIN=https://your-domain.vercel.app
AI_PROVIDER=groq
GROQ_KEY=your_groq_key_here
GROQ_MODEL=llama3-70b-8192
ANTHROPIC_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
NEWS_KEY=your_newsapi_key_here
```

`ANTHROPIC_KEY` and `ANTHROPIC_MODEL` are optional unless `AI_PROVIDER=anthropic`.

---

## Architecture

```text
jarvis/
├── api/
│   ├── chat.js
│   └── news.js
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── components/
│   │   ├── AgentSwarmPanel.jsx
│   │   ├── AlertsPanel.jsx
│   │   ├── Changelog.jsx
│   │   ├── ChartPanel.jsx
│   │   ├── ChatPanel.jsx
│   │   ├── CompareTable.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── HeadlinesPanel.jsx
│   │   ├── RiskMeter.jsx
│   │   ├── SidePanel.jsx
│   │   ├── SignalBox.jsx
│   │   ├── TickerCard.jsx
│   │   ├── TradeJournal.jsx
│   │   └── Watchlist.jsx
│   ├── hooks/
│   │   ├── useAI.js
│   │   ├── useAlertChecker.js
│   │   ├── useKeyboardShortcuts.js
│   │   └── useMarketData.js
│   ├── self-evolving-os/
│   │   └── selfEvolvingOS.js
│   ├── services/
│   │   └── marketData.js
│   ├── utils/
│   │   ├── assets.js
│   │   ├── exportSummary.js
│   │   ├── exportSummary.test.js
│   │   ├── indicators.js
│   │   ├── indicators.test.js
│   │   └── prompts.js
│   ├── App.css
│   ├── App.js
│   └── index.js
├── .env.example
├── DEPLOYMENT.md
├── package-lock.json
├── package.json
├── README.md
└── vercel.json
```

---

## Running Tests

```bash
npm test
```

Run bundle analysis:

```bash
npm run build && npm run analyze
```

---

## Disclaimer

Paper trading / simulation only. Not financial advice.
Never risk capital you cannot afford to lose.
