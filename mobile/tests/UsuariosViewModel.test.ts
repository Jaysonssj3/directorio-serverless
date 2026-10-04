import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UsuariosViewModel } from '../src/viewmodels/UsuariosViewModel';
import type { UsuariosGateway } from '../src/data/UsuariosRepository';
import type { Page, Usuario, UsuarioInput } from '../src/models/Usuario';
const admin: Usuario = { id: 'admin-id', nombre: 'Admin', email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00Z' };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function repository(overrides: Partial<UsuariosGateway> = {}): UsuariosGateway {
  return { me: async () => admin, list: async page => ({ content: [admin], page, size: 10 }), get: async () => admin,
    create: async () => admin, update: async () => admin, remove: async () => {}, upload: async () => {}, ...overrides };
}
test('starts profile and list concurrently, retaining profile when list fails', async () => {
  const me = deferred<Usuario>(), list = deferred<Page>(); const started: string[] = [];
  const vm = new UsuariosViewModel(repository({ me: () => { started.push('me'); return me.promise; }, list: () => { started.push('list'); return list.promise; } }), admin);
  const loading = vm.load();
  assert.deepEqual(started, ['me', 'list']); // ninguna petición ha terminado todavía
  me.resolve({ ...admin, nombre: 'Actualizado' }); list.reject(new Error('Lista no disponible'));
  await loading;
  assert.equal(vm.getSnapshot().profile.nombre, 'Actualizado');
  assert.equal(vm.getSnapshot().listError, 'Lista no disponible');
  assert.equal(vm.getSnapshot().loading, false);
});
test('ignores an older response arriving after a newer page', async () => {
  const first = deferred<Page>();
  const vm = new UsuariosViewModel(repository({ list: page => page === 0 ? first.promise : Promise.resolve({ content: [], page, size: 10 }) }), admin);
  const old = vm.load(0); await vm.load(1); first.resolve({ content: [admin], page: 0, size: 10 }); await old;
  assert.equal(vm.getSnapshot().page, 1); assert.deepEqual(vm.getSnapshot().users, []);
});
test('USER profile never requests the protected admin list', async () => {
  let lists = 0;
  const user = { ...admin, role: 'USER' as const };
  const vm = new UsuariosViewModel(repository({ me: async () => user, list: async () => { lists++; throw Error('Forbidden'); } }), user);
  await vm.load(); assert.equal(lists, 0); assert.equal(vm.getSnapshot().profile.role, 'USER');
});
test('CRUD sends expected data and blocks accidental self deletion', async () => {
  const calls: unknown[] = [];
  const vm = new UsuariosViewModel(repository({
    create: async input => { calls.push(input); return admin; }, update: async (id, input) => { calls.push([id, input]); return admin; },
    get: async id => { calls.push(id); return { ...admin, id }; }, remove: async id => { calls.push(id); }
  }), admin);
  const input: UsuarioInput = { nombre: ' Ana ', email: 'ana@example.com', password: 'Password123456!', role: 'USER' };
  assert.equal(await vm.save(input), true); assert.equal((calls[0] as UsuarioInput).nombre, 'Ana');
  await vm.select('ana-id'); assert.equal(vm.getSnapshot().selected?.id, 'ana-id');
  await vm.save(input, 'ana-id'); assert.deepEqual(calls[2], ['ana-id', { nombre: 'Ana', email: 'ana@example.com' }]);
  await vm.remove('ana-id'); assert.equal(calls[3], 'ana-id');
  await vm.remove(admin.id); assert.equal(calls.length, 4); assert.match(vm.getSnapshot().error, /propia cuenta/);
});
test('canceling image picker does not upload; server rejection reaches view', async () => {
  let uploads = 0;
  const vm = new UsuariosViewModel(repository({ upload: async () => { uploads++; throw Error('Archivo inválido'); } }), admin);
  await vm.upload(async () => null); assert.equal(uploads, 0);
  await vm.upload(async () => ({ uri: 'file:///photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }));
  assert.equal(uploads, 1); assert.equal(vm.getSnapshot().error, 'Archivo inválido'); assert.equal(vm.getSnapshot().saving, false);
});
