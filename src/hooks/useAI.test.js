import { callProxy } from './useAI';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('callProxy returns model text from JSON response', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: () => Promise.resolve(JSON.stringify({ text: 'analysis ready' })),
  });

  await expect(callProxy([], 'system')).resolves.toBe('analysis ready');
});

test('callProxy surfaces proxy error fields as system messages', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 500,
    headers: { get: () => 'application/json' },
    text: () => Promise.resolve(JSON.stringify({ error: 'Provider unavailable' })),
  });

  await expect(callProxy([], 'system')).rejects.toMatchObject({
    message: 'Provider unavailable',
    systemMessage: true,
  });
});

test('callProxy reports non-json local proxy failures clearly', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    text: () => Promise.resolve('<!DOCTYPE html><html></html>'),
  });

  await expect(callProxy([], 'system')).rejects.toMatchObject({
    systemMessage: true,
  });
});
