# Jarvis AI — Hedge Fund Intelligence Engine

Ruflo multi-agent trading analysis system.
Supports Ollama (local/free), Groq (free cloud), Anthropic (paid/best quality), and a Vercel proxy mode for public deployments.

---

## Quick Start — Local with Ollama (free)

### Step 1 — Install dependencies

Make sure you have Node.js installed (nodejs.org).

```bash
npm install
```

### Step 2 — Install and start Ollama

1. Download Ollama from https://ollama.com
2. Install it on your computer
3. Open a terminal and run:

```bash
ollama pull llama3.2
ollama serve
```

Keep this terminal open. Ollama runs at http://localhost:11434

### Step 3 — Configure environment

Copy the example env file:

```bash
cp .env.example .env.local
```

Open `.env.local` and make sure it says:

```
REACT_APP_AI_PROVIDER=ollama
REACT_APP_OLLAMA_MODEL=llama3.2
```

### Step 4 — Start Jarvis

```bash
npm start
```

Open http://localhost:3000 in your browser. Done!

---

## Switch to Groq (free cloud — for public website)

1. Sign up free at https://console.groq.com
2. Create an API key
3. Open `.env.local` and change:

```
REACT_APP_AI_PROVIDER=groq
REACT_APP_GROQ_KEY=your_groq_key_here
```

4. Restart with `npm start`

---

## Deploy to Vercel (free public website)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial Jarvis commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/jarvis-ai.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "New Project" → import your jarvis-ai repo
3. Click Deploy

### Step 3 — Add environment variables on Vercel

In Vercel dashboard → Settings → Environment Variables, add:

```
AI_PROVIDER = groq
GROQ_KEY    = your_groq_key_here
```

### Step 4 — Update your React app for production

When deployed publicly, the React app now defaults to `/api/chat` proxy mode.
This keeps your API key hidden on the server instead of shipping it to the browser.

For local testing you can still set `REACT_APP_AI_PROVIDER=ollama`, `groq`, or `anthropic`.
For public Vercel deploys, set server-side variables such as `AI_PROVIDER`, `GROQ_KEY`, and optional model overrides.

---

## Models you can use with Ollama

| Model | Size | Quality | Command |
|-------|------|---------|---------|
| llama3.1 | 4.7GB | Best | `ollama pull llama3.1` |
| mistral | 4.1GB | Good | `ollama pull mistral` |
| gemma2 | 5.5GB | Good | `ollama pull gemma2` |
| llama3.2 | 2.0GB | Lighter | `ollama pull llama3.2` |
| phi3 | 2.3GB | Fast | `ollama pull phi3` |

---

## Project structure

```
jarvis/
├── public/
│   └── index.html          — base HTML
├── src/
│   ├── App.js              — main app + all components
│   ├── App.css             — full dark theme styles
│   ├── index.js            — React entry point
│   ├── hooks/
│   │   └── useAI.js        — AI provider switcher (Ollama/Groq/Anthropic/proxy)
│   ├── services/
│   │   └── marketData.js   — live market data + RSI/MACD/EMA calculations
│   └── utils/
│       ├── prompts.js      — Jarvis system prompt builder
│       └── assets.js       — ticker data + agent definitions
├── api/
│   └── chat.js             — Vercel serverless proxy (hides API key)
├── .env.example            — copy to .env.local and fill in
├── .gitignore              — protects your secrets
├── vercel.json             — Vercel routing config
└── package.json            — dependencies
```

---

## Disclaimer

Paper trading / simulation only. Not financial advice.
Never risk capital you cannot afford to lose.
