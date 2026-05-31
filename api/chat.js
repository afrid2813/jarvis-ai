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

import { applyCors, assertReasonableBody, createMemoryRateLimiter, fetchJsonWithTimeout, getClientIp, logError } from './_shared.js';

const PROVIDER = process.env.AI_PROVIDER || 'groq';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const PROVIDER_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15_000);
const INSTANCE_HOURLY_LIMIT = Number(process.env.AI_INSTANCE_HOURLY_LIMIT || 300);

// Simple in-memory rate limiter (resets on cold start)
const checkRateLimit = createMemoryRateLimiter({ maxRequests: 10, windowMs: 60 * 1000 });
const checkInstanceBudget = createMemoryRateLimiter({
  maxRequests: INSTANCE_HOURLY_LIMIT,
  windowMs: 60 * 60 * 1000,
  maxKeys: 1,
});

function missingKeyError(provider) {
  return {
    error: provider === 'anthropic'
      ? 'Anthropic is selected, but ANTHROPIC_KEY is missing. Add it to .env.local for local dev or Vercel environment variables for production.'
      : 'Groq is selected, but GROQ_KEY is missing. Add it to .env.local for local dev or Vercel environment variables for production.',
  };
}

function sanitizeMessages(messages) {
  const blocked = /SYSTEM:|IGNORE PREVIOUS|You are now|Disregard/gi;

  return messages.map(message => ({
    ...message,
    content: String(message.content || '').replace(blocked, '').slice(0, 2000),
  }));
}

export default async function handler(req, res) {
  const ip = getClientIp(req);

  try {
    if (!applyCors(req, res, ['POST', 'OPTIONS'])) {
      return res.status(403).json({ error: 'Forbidden origin' });
    }

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!assertReasonableBody(req)) return res.status(413).json({ error: 'Request too large' });

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
    }
    if (!checkInstanceBudget('ai-provider')) {
      return res.status(429).json({ error: 'AI request budget temporarily exhausted. Try again later.' });
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

      const { response: r, data } = await fetchJsonWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
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
      }, PROVIDER_TIMEOUT_MS);
      if (!r.ok) throw new Error(data.error?.message || 'Groq error');
      text = data.choices?.[0]?.message?.content || '';

    } else if (PROVIDER === 'anthropic') {
      const key = process.env.ANTHROPIC_KEY;
      if (!key) return res.status(500).json(missingKeyError('anthropic'));

      const { response: r, data } = await fetchJsonWithTimeout('https://api.anthropic.com/v1/messages', {
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
      }, PROVIDER_TIMEOUT_MS);
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
