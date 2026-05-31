# Deploying Jarvis AI to Vercel

## Prerequisites

- Node.js 18+
- GitHub account
- Vercel account (free tier is enough)
- Groq API key (free at console.groq.com) OR Anthropic API key

## Step-by-step

### 1. Fork / clone the repo

Fork the project on GitHub or clone your own copy locally.

```bash
git clone https://github.com/YOUR_USERNAME/jarvis-ai.git
cd jarvis-ai
```

### 2. Install and run locally

```bash
npm install
npm start
```

Open http://localhost:3000 and confirm the app loads. `npm start` runs the local Jarvis proxy so API routes like `/api/chat` are available without a Vercel CLI login. Use `npm run start:vercel` when you specifically want Vercel Dev.

### 3. Get your API keys

- Groq: free at console.groq.com -> API Keys
- NewsAPI: free at newsapi.org (dev tier: 100 req/day)
- Anthropic: paid at console.anthropic.com

### 4. Push to GitHub

```bash
git add .
git commit -m "Deploy Jarvis AI"
git push origin main
```

### 5. Connect to Vercel

1. Open Vercel.
2. Choose New Project.
3. Import your GitHub repo.
4. Keep the default React build settings.

### 6. Set environment variables

Add these in Vercel Project Settings -> Environment Variables:

| Variable | Description |
|---|---|
| `ALLOWED_ORIGIN` | Your deployed frontend URL, for example `https://your-app.vercel.app`. |
| `AI_PROVIDER` | AI backend provider. Use `groq` or `anthropic`. |
| `GROQ_KEY` | Server-side Groq API key. Required when `AI_PROVIDER=groq`. |
| `GROQ_MODEL` | Groq model name, for example `llama3-70b-8192`. |
| `ANTHROPIC_KEY` | Server-side Anthropic API key. Required when `AI_PROVIDER=anthropic`. |
| `ANTHROPIC_MODEL` | Anthropic model name, for example `claude-sonnet-4-20250514`. |
| `NEWS_KEY` | Server-side NewsAPI key for headlines. |
| `REACT_APP_AI_PROVIDER` | Client mode. Keep as `proxy`. |

Never put Groq, Anthropic, or NewsAPI secrets in browser-exposed `REACT_APP_*` variables.

### 7. Deploy and verify

Deploy from Vercel. After deployment:

1. Open the production URL.
2. Confirm market data loads.
3. Run a small AI prompt.
4. Confirm News Headlines either load or show an empty state.
5. Confirm `/api/chat` and `/api/news` are not returning CORS errors.

### 8. Set ALLOWED_ORIGIN to your production URL

After your first deploy, copy the final Vercel URL and set:

```bash
ALLOWED_ORIGIN=https://your-app.vercel.app
```

Redeploy after changing the environment variable.

## Troubleshooting

- API returns 403 Forbidden -> `ALLOWED_ORIGIN` mismatch.
- No AI response -> check `AI_PROVIDER` and the matching key in Vercel environment variables.
- Headlines not loading -> `NEWS_KEY` missing or NewsAPI free tier exhausted.
- Stale data banner always showing -> Binance or Yahoo Finance blocked by network.

## Cost estimate

| Service | Estimated cost |
|---|---:|
| Vercel | Free |
| Groq | Free |
| NewsAPI dev | Free |
| Anthropic | Paid, about $0.01/analysis |
