# Jarvis AI — Hedge Fund Intelligence Engine

Jarvis AI is a React + Vercel paper-trading intelligence app with live market data, technical indicators, multi-phase AI analysis, and a self-evolving agent workflow.

---

## Features

- Live market data from Binance public crypto feeds and Yahoo Finance chart data
- Real RSI, MACD, and EMA indicators
- 3-phase AI analysis: Beginner, Analyst, and Hedge Fund
- Multi-agent swarm analysis in Phase 3
- Self-Evolving OS with local strategy traces and agent scoring
- Fear & Greed index
- News Agent headlines through NewsAPI
- Trade journal with P&L tracking
- CSV export for recorded signals
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
REACT_APP_NEWS_KEY=your_newsapi_key_here
```

AI provider secrets must be configured as server environment variables on Vercel, not as `REACT_APP_*` client variables.

### 3. Run Locally

```bash
npm start
```

Open http://localhost:3000.

### 4. Deploy To Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the server environment variables listed below.
4. Deploy.

The React app calls `/api/chat`; Vercel runs `api/chat.js` as the protected serverless proxy.

---

## Environment Variables

### Client

```bash
REACT_APP_AI_PROVIDER=proxy
REACT_APP_NEWS_KEY=your_newsapi_key_here
```

### Server / Vercel

```bash
ALLOWED_ORIGIN=https://your-domain.vercel.app
AI_PROVIDER=groq
GROQ_KEY=your_groq_key_here
GROQ_MODEL=llama3-70b-8192
ANTHROPIC_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

`ANTHROPIC_KEY` and `ANTHROPIC_MODEL` are optional unless `AI_PROVIDER=anthropic`.

---

## Project Structure

```text
jarvis/
├── api/
│   └── chat.js
├── public/
│   └── index.html
├── src/
│   ├── components/
│   ├── hooks/
│   ├── self-evolving-os/
│   ├── services/
│   ├── utils/
│   ├── App.css
│   ├── App.js
│   └── index.js
├── .env.example
├── package.json
├── README.md
└── vercel.json
```

---

## Disclaimer

Paper trading / simulation only. Not financial advice.
Never risk capital you cannot afford to lose.
