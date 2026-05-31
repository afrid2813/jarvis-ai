import { AGENTS } from './assets';

export function extractSignal(text) {
  const match = text.match(/<signal>(.*?)<\/signal>/s);
  if (!match) return null;
  try {
    return normalizeSignal(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

export function cleanSignalText(text) {
  return text.replace(/<signal>.*?<\/signal>/s, '').trim();
}

function normalizeSignal(signal) {
  const actions = ['BUY', 'SELL', 'HOLD', 'WAIT'];
  const risks = ['LOW', 'MEDIUM', 'HIGH'];
  const action = actions.includes(signal.action) ? signal.action : 'HOLD';
  const risk = risks.includes(signal.risk) ? signal.risk : 'MEDIUM';
  const confidence = Math.max(0, Math.min(100, Number(signal.confidence) || 0));
  const swarm = Array.isArray(signal.swarm)
    ? signal.swarm.slice(0, AGENTS.length).map(value => Math.max(0, Math.min(100, Number(value) || 0)))
    : null;

  return {
    ...signal,
    action,
    risk,
    confidence,
    swarm: swarm && swarm.length === AGENTS.length ? swarm : null,
  };
}
