export const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:3000';

export function getAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function getClientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '');
  return forwarded.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

export function logError({ path, ip, err }) {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    path,
    ip,
    error: err.message,
  }));
}

export function applyCors(req, res, methods) {
  const origin = req.headers?.origin;
  const allowedOrigins = getAllowedOrigins();

  if (!origin || !allowedOrigins.includes(origin)) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Jarvis-Client');
  return true;
}

export function createMemoryRateLimiter({ maxRequests, windowMs, maxKeys = 5000 }) {
  const records = new Map();

  return function checkRateLimit(key) {
    const now = Date.now();
    const record = records.get(key) || { count: 0, start: now };

    if (now - record.start > windowMs) {
      record.count = 0;
      record.start = now;
    }

    record.count++;
    records.set(key, record);

    if (records.size > maxKeys) {
      for (const [recordKey, value] of records) {
        if (now - value.start > windowMs) records.delete(recordKey);
        if (records.size <= maxKeys) break;
      }
    }

    return record.count <= maxRequests;
  };
}

export async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function assertReasonableBody(req, maxBytes = 32_000) {
  const length = Number(req.headers?.['content-length'] || 0);
  return !Number.isFinite(length) || length <= maxBytes;
}
