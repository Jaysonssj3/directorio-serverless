import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionViewModel } from '../src/viewmodels/SessionViewModel';
import { ApiClient } from '../src/data/ApiClient';
import type { SessionStorage } from '../src/data/SessionStore';
import type { Session, Usuario } from '../src/models/Usuario';
const user: Usuario = { id: '1', nombre: 'Test', email: 't@example.com', role: 'USER', createdAt: '' };
function storage(saved: Session | null = null): SessionStorage {
  return { read: async () => saved, write: async s => { saved = s; }, readUrl: async () => 'http://10.0.2.2:8080', writeUrl: async () => {} };
}
const repo = { me: async () => user, register: async () => user, login: async () => ({ accessToken: 'test', tokenType: 'Bearer', expiresIn: 900 }) };
test('restoration rejects expired token before querying API', async () => {
  let calls = 0;
  const store = storage({ accessToken: 'expired', expiresAt: 1, baseUrl: 'http://10.0.2.2:8080' });
  const vm = new SessionViewModel(new ApiClient(), { ...repo, me: async () => { calls++; return user; } }, store);
  await vm.restore(); assert.equal(calls, 0); assert.equal(await store.read(), null); assert.equal(vm.getSnapshot().ready, true);
});
test('login persists token without password and logout clears token and user', async () => {
  const api = new ApiClient(), store = storage(), vm = new SessionViewModel(api, repo, store);
  await vm.login('http://10.0.2.2:8080', 't@example.com', 'SecretPassword!');
  assert.equal(vm.getSnapshot().user?.id, user.id); assert.equal(api.token, 'test');
  assert.equal(JSON.stringify(await store.read()).includes('SecretPassword!'), false);
  await vm.logout(); assert.equal(api.token, null); assert.equal(await store.read(), null); assert.equal(vm.getSnapshot().user, null);
});
test('saved session cannot send its token to a different server', async () => {
  const api = new ApiClient(), store = storage({ accessToken: 'foreign', expiresAt: Date.now() + 10000, baseUrl: 'https://other.example.com' });
  const vm = new SessionViewModel(api, repo, store); await vm.restore();
  assert.equal(api.token, null); assert.equal(await store.read(), null);
});
