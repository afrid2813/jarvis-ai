function formatPrice(asset) {
  const price = Number(asset?.price);
  if (!Number.isFinite(price)) return 'Unavailable';
  if (price < 10) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBand(value) {
  if (!Number.isFinite(value)) return 'Unavailable';
  if (value < 10) return value.toFixed(4);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function exportSummary(asset, lastSignal, fearAndGreed, headlines) {
  const date = new Date();
  const bands = asset.bollingerBands;
  const report = [
    'JARVIS AI — ANALYSIS SUMMARY',
    `Generated: ${date.toLocaleString()}`,
    `Asset: ${asset.symbol} @ ${formatPrice(asset)}`,
    `Change: ${asset.change}%`,
    `RSI: ${asset.rsi} | MACD: ${asset.macd} | Trend: ${asset.trend}`,
    `Bollinger Bands: Upper ${formatBand(bands?.upper)} / Mid ${formatBand(bands?.middle)} / Lower ${formatBand(bands?.lower)}`,
    `Fear & Greed: ${fearAndGreed ? `${fearAndGreed.value} — ${fearAndGreed.classification}` : 'Unavailable'}`,
    `Last Signal: ${lastSignal ? `${lastSignal.action} · ${lastSignal.confidence}% · ${lastSignal.risk} risk` : 'Unavailable'}`,
    'Recent Headlines:',
    ...(headlines?.length ? headlines.map(headline => `- ${headline.title} (${headline.source})`) : ['- No headlines available']),
  ].join('\n');
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeSymbol = asset.symbol.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  link.href = url;
  link.download = `jarvis-summary-${safeSymbol}-${date.toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
