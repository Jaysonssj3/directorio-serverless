import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError, normalizeUrl } from '../src/data/ApiClient';
test('attaches JWT only to authenticated calls and handles empty DELETE response', async () => {
  const headers: Headers[] = [];
  const api = new ApiClient(async (_url, options) => { headers.push(new Headers(options?.headers)); return new Response(null, { status: 204 }); });
  api.token = 'example-token';
  await api.request('/api/usuarios/id', { method: 'DELETE' });
  await api.request('/api/auth/login', { method: 'POST', body: '{}' }, false);
  assert.equal(headers[0]?.get('Authorization'), 'Bearer example-token');
  assert.equal(headers[1]?.get('Authorization'), null);
});
test('401 invalidates session; 403 preserves session and reports denial', async () => {
  let invalidations = 0, status = 403;
  const api = new ApiClient(async () => new Response(JSON.stringify({ title: 'Denegado' }), { status }));
  api.token = 'token'; api.onUnauthorized = () => { invalidations++; };
  await assert.rejects(api.request('/test'), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.equal(invalidations, 0); status = 401;
  await assert.rejects(api.request('/test')); assert.equal(invalidations, 1);
});
test('timeout aborts an unavailable request with an actionable message', async () => {
  const api = new ApiClient((_url, options) => new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => reject(Error('aborted'))); }), 5);
  await assert.rejects(api.request('/test'), /tardó demasiado/);
});
test('server URL validation rejects credentials, API paths and public plaintext', () => {
  assert.equal(normalizeUrl(' http://192.168.1.2:8080/ '), 'http://192.168.1.2:8080');
  assert.equal(normalizeUrl('https://api.example.com'), 'https://api.example.com');
  for (const input of ['http://api.example.com', 'http://a:b@localhost:8080', 'http://localhost:8080/api', 'garbage']) assert.throws(() => normalizeUrl(input));
});
test('a local multipart preparation error is not reported as a Wi-Fi failure', async () => {
  const api = new ApiClient(async () => { throw new Error('Unsupported FormDataPart implementation'); });
  await assert.rejects(api.request('/api/usuarios/me/avatar', { method: 'POST' }), /preparar el archivo/);
});
test('invalid JSON after a successful HTTP response is not reported as a network failure', async () => {
  const api = new ApiClient(async () => new Response('not JSON', { status: 200 }));
  await assert.rejects(api.request('/test'), /formato de la respuesta/);
});
