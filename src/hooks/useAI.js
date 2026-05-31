// src/hooks/useAI.js
// ─────────────────────────────────────────────
// Unified AI hook — works with Ollama (local),
// Groq (free cloud), or Anthropic (paid cloud).
// Switch providers by changing REACT_APP_AI_PROVIDER in .env.local
// ─────────────────────────────────────────────

const DEFAULT_PROVIDER = process.env.NODE_ENV === 'production' ? 'proxy' : 'ollama';
const PROVIDER = process.env.REACT_APP_AI_PROVIDER || DEFAULT_PROVIDER;

// ── Vercel proxy (production-safe) ───────────
async function callProxy(messages, systemPrompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Proxy error: ${res.status}`);

  return data.text || '';
}

// ── Ollama (local) ──────────────────────────
async function callOllama(messages, systemPrompt) {
  const model = process.env.REACT_APP_OLLAMA_MODEL || 'llama3.2';
  const url = process.env.REACT_APP_OLLAMA_URL || 'http://localhost:11434';

  // Convert messages to Ollama format
  const prompt = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: prompt,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error: ${err}. Install it with: ollama pull ${model}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}

// ── Groq (free cloud) ───────────────────────
async function callGroq(messages, systemPrompt) {
  const key = process.env.REACT_APP_GROQ_KEY;
  const model = process.env.REACT_APP_GROQ_MODEL || 'llama3-70b-8192';

  if (!key || key === 'your_groq_key_here') {
    throw new Error('Groq API key not set. Add REACT_APP_GROQ_KEY to .env.local');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Groq error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic (paid, best quality) ──────────
async function callAnthropic(messages, systemPrompt) {
  const key = process.env.REACT_APP_ANTHROPIC_KEY;

  if (!key || key === 'your_anthropic_key_here') {
    throw new Error('Anthropic key not set. Add REACT_APP_ANTHROPIC_KEY to .env.local');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Anthropic error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

// ── Main hook ───────────────────────────────
export function useAI() {
  async function analyze(messages, systemPrompt) {
    switch (PROVIDER) {
      case 'proxy':
        return callProxy(messages, systemPrompt);
      case 'groq':
        return callGroq(messages, systemPrompt);
      case 'anthropic':
        return callAnthropic(messages, systemPrompt);
      case 'ollama':
      default:
        return callOllama(messages, systemPrompt);
    }
  }

  return { analyze, provider: PROVIDER };
}
