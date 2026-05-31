// src/hooks/useAI.js
// ─────────────────────────────────────────────
// Unified AI hook.
// All model traffic goes through /api/chat so API keys never ship
// in the browser bundle.
// ─────────────────────────────────────────────

const DEFAULT_PROVIDER = 'proxy';
const PROVIDER = DEFAULT_PROVIDER;

// ── Vercel proxy (production-safe) ───────────
async function callProxy(messages, systemPrompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text();

  if (!contentType.includes('application/json')) {
    const err = new Error(
      bodyText.trim().startsWith('<!DOCTYPE')
        ? 'Local API proxy is not running. Start Jarvis with Vercel dev, or deploy to Vercel with GROQ_KEY/ANTHROPIC_KEY set.'
        : `Proxy returned non-JSON response: ${res.status}`
    );
    err.systemMessage = true;
    throw err;
  }

  let data = {};
  try {
    data = JSON.parse(bodyText);
  } catch {
    const err = new Error('Proxy returned invalid JSON.');
    err.systemMessage = true;
    throw err;
  }

  if (data.error) {
    const err = new Error(data.error);
    err.systemMessage = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);

  return data.text || '';
}

// ── Main hook ───────────────────────────────
export function useAI() {
  async function analyze(messages, systemPrompt) {
    return callProxy(messages, systemPrompt);
  }

  return { analyze, provider: PROVIDER };
}
