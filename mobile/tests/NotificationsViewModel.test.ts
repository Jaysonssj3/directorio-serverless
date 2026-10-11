import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationsViewModel } from '../src/viewmodels/NotificationsViewModel';
function fill(vm: NotificationsViewModel) { vm.change('email', 'demo@example.com'); vm.change('subject', 'Prueba'); vm.change('message', 'Hola'); }
test('invalid input never reaches backend', async () => {
 let calls=0; const vm=new NotificationsViewModel({ send: async () => { calls++; throw Error(); } });
 await vm.send(); assert.equal(calls,0); assert.ok(vm.getSnapshot().error);
});
test('queued result and duplicate tap guard', async () => {
 let calls=0; let resolve!: (v: { notificationId: string; status: 'QUEUED'; message: string }) => void;
 const vm=new NotificationsViewModel({send: () => {calls++;return new Promise(r=>{resolve=r;});}});fill(vm);
 const pending=vm.send();await vm.send();assert.equal(calls,1);assert.equal(vm.getSnapshot().sending,true);
 resolve({notificationId:'id',status:'QUEUED',message:'ok'});await pending;
 assert.equal(vm.getSnapshot().notice,'Mensaje enviado correctamente.');assert.equal(vm.getSnapshot().notificationId,'id');
});
test('failure permits a later retry without success notice', async () => {
 const vm=new NotificationsViewModel({send:async()=>{throw Error('unavailable');}});fill(vm);await vm.send();
 assert.equal(vm.getSnapshot().sending,false);assert.equal(vm.getSnapshot().notice,'');assert.equal(vm.getSnapshot().error,'Error al enviar mensaje.');
});
