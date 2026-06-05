import chatHandler from '../api/chat';
import newsHandler from '../api/news';

function createReq({ method = 'GET', body, query = {}, origin = 'http://localhost:3000', ip = '203.0.113.1' } = {}) {
  return {
    method,
    body,
    query,
    headers: {
      origin,
      'x-forwarded-for': ip,
      'content-length': body ? String(JSON.stringify(body).length) : '0',
    },
    socket: { remoteAddress: ip },
  };
}

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

beforeEach(() => {
  process.env.ALLOWED_ORIGIN = 'http://localhost:3000';
  delete process.env.ALLOW_VERCEL_PREVIEWS;
  delete process.env.GROQ_KEY;
  delete process.env.NEWS_KEY;
});

test('chat blocks forbidden origins', async () => {
  const req = createReq({
    method: 'POST',
    origin: 'https://evil.example',
    body: { messages: [], systemPrompt: 'test' },
  });
  const res = createRes();

  await chatHandler(req, res);

  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('Forbidden origin');
});

test('chat blocks vercel preview origins unless explicitly enabled', async () => {
  const req = createReq({
    method: 'POST',
    origin: 'https://jarvis-preview.vercel.app',
    body: { messages: [], systemPrompt: 'test' },
    ip: '203.0.113.5',
  });
  const res = createRes();

  await chatHandler(req, res);

  expect(res.statusCode).toBe(403);
});

test('chat allows vercel preview origins when explicitly enabled', async () => {
  process.env.ALLOW_VERCEL_PREVIEWS = 'true';
  const req = createReq({
    method: 'POST',
    origin: 'https://jarvis-preview.vercel.app',
    body: { messages: [], systemPrompt: 'test' },
    ip: '203.0.113.6',
  });
  const res = createRes();

  await chatHandler(req, res);

  expect(res.statusCode).toBe(500);
  expect(res.headers['Access-Control-Allow-Origin']).toBe('https://jarvis-preview.vercel.app');
});

test('chat validates required body fields', async () => {
  const req = createReq({ method: 'POST', body: {}, ip: '203.0.113.2' });
  const res = createRes();

  await chatHandler(req, res);

  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('Missing messages or systemPrompt');
});

test('chat returns a clear missing key error before provider fetch', async () => {
  const req = createReq({
    method: 'POST',
    body: { messages: [], systemPrompt: 'test' },
    ip: '203.0.113.3',
  });
  const res = createRes();

  await chatHandler(req, res);

  expect(res.statusCode).toBe(500);
  expect(res.body.error).toContain('GROQ_KEY is missing');
});

test('news returns an empty article list when NEWS_KEY is missing', async () => {
  const req = createReq({ method: 'GET', query: { symbol: 'BTC/USD' }, ip: '203.0.113.4' });
  const res = createRes();

  await newsHandler(req, res);

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ articles: [] });
});
