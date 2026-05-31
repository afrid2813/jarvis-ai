// api/chat.js
// ─────────────────────────────────────────────
// Vercel serverless function — API proxy
// Keeps your Groq/Anthropic key hidden from the browser.
// Your React app calls /api/chat instead of the AI provider directly.
//
// HOW IT WORKS:
//   Browser → /api/chat (this file on Vercel) → AI provider → response
//
// SET UP ON VERCEL:
//   Dashboard → Settings → Environment Variables → add:
//   GROQ_KEY = your_groq_key
//   ANTHROPIC_KEY = your_anthropic_key  (optional)
//   AI_PROVIDER = groq   (or: anthropic)
// ─────────────────────────────────────────────

const PROVIDER = process.env.AI_PROVIDER || 'groq';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-70b-8192';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// Simple in-memory rate limiter (resets on cold start)
const rateLimits = new Map();
const MAX_REQUESTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

function getIp(req) {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

function logError({ path, ip, err }) {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    path,
    ip,
    error: err.message,
  }));
}

function missingKeyError(provider) {
  return {
    error: provider === 'anthropic'
      ? 'Anthropic is selected, but ANTHROPIC_KEY is missing. Add it to .env.local for local dev or Vercel environment variables for production.'
      : 'Groq is selected, but GROQ_KEY is missing. Add it to .env.local for local dev or Vercel environment variables for production.',
  };
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip) || { count: 0, start: now };

  if (now - record.start > WINDOW_MS) {
    record.count = 0;
    record.start = now;
  }

  record.count++;
  rateLimits.set(ip, record);

  return record.count <= MAX_REQUESTS;
}

function sanitizeMessages(messages) {
  const blocked = /SYSTEM:|IGNORE PREVIOUS|You are now|Disregard/gi;

  return messages.map(message => ({
    ...message,
    content: String(message.content || '').replace(blocked, '').slice(0, 2000),
  }));
}

export default async function handler(req, res) {
  const ip = getIp(req);

  try {
    const origin = req.headers.origin;

    if (origin !== ALLOWED_ORIGIN) {
      return res.status(403).json({ error: 'Forbidden origin' });
    }

    // CORS headers — allow only the configured frontend origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
    }

    const { messages, systemPrompt } = req.body;

    if (!Array.isArray(messages) || typeof systemPrompt !== 'string') {
      return res.status(400).json({ error: 'Missing messages or systemPrompt' });
    }

    if (messages.length > 20 || systemPrompt.length > 8000) {
      return res.status(400).json({ error: 'Request too large' });
    }

    const sanitizedMessages = sanitizeMessages(messages);
    let text = '';

    if (PROVIDER === 'groq') {
      const key = process.env.GROQ_KEY;
      if (!key) return res.status(500).json(missingKeyError('groq'));

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1000,
          messages: [{ role: 'system', content: systemPrompt }, ...sanitizedMessages],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Groq error');
      text = data.choices?.[0]?.message?.content || '';

    } else if (PROVIDER === 'anthropic') {
      const key = process.env.ANTHROPIC_KEY;
      if (!key) return res.status(500).json(missingKeyError('anthropic'));

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages: sanitizedMessages,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Anthropic error');
      text = data.content?.map(b => b.text || '').join('') || '';
    } else {
      return res.status(400).json({ error: `Unsupported AI_PROVIDER: ${PROVIDER}` });
    }

    return res.status(200).json({ text });

  } catch (err) {
    logError({ path: '/api/chat', ip, err });
    return res.status(500).json({ error: 'Internal error' });
  }
}
