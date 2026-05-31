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

  const data = await res.json();
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
