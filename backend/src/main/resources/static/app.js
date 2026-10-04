'use strict';
// El JWT vive únicamente en memoria: no se guarda en cookies ni localStorage.
const $ = id => document.getElementById(id);
const state = { token: null, me: null, page: 0, size: 10, users: [], registration: false, editing: null, deleting: null, timer: null, generation: 0, listRequest: 0 };
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function message(id, text) { $(id).textContent = text; $(id).hidden = !text; }
function notice(text, bad = false) { message('notice', text); $('notice').classList.toggle('bad', bad); }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase(); }
function roleLabel(role) { return role === 'ADMIN' ? 'Administrador' : 'Usuario'; }
function badge(role) { return node('span', roleLabel(role), 'badge' + (role === 'ADMIN' ? ' admin' : '')); }
function date(value) { return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value)); }
function passwordValid(value) { return value.length >= 12 && new TextEncoder().encode(value).length <= 72; }
function resetSession(text = '') {
  state.generation++; state.listRequest++;
  clearTimeout(state.timer); state.token = null; state.me = null; state.users = []; state.page = 0;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  $('workspace').hidden = true; $('auth-view').hidden = false;
  $('auth-password').value = ''; $('edit-password').value = '';
  $('users-body').replaceChildren(); $('profile-card').replaceChildren(); $('detail-content').replaceChildren();
  $('search').value = ''; message('auth-error', text); notice('');
  $('auth-email').focus();
}
async function api(path, { method = 'GET', body, authenticated = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (authenticated && state.token) headers.Authorization = 'Bearer ' + state.token;
  let response;
  try { response = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store' }); }
  catch { throw new Error('No se pudo conectar con la aplicación. Comprueba que la ventana de Java siga abierta.'); }
  let data = null;
  if (response.status !== 204) {
    try { data = await response.json(); } catch { /* Mensaje genérico si el servidor no devuelve JSON. */ }
  }
  if (!response.ok) {
    if (response.status === 401 && authenticated) resetSession('Tu sesión terminó. Vuelve a iniciar sesión.');
    if (response.status === 403 && state.me) notice('Tu cuenta no tiene permiso para realizar esta operación.', true);
    const detail = data?.errors?.join('. ') || data?.detail || data?.title;
    throw new Error(response.status === 401 && !authenticated ? 'El correo o la contraseña no son correctos.' : detail || 'No se pudo completar la operación. Inténtalo de nuevo.');
  }
  return data;
}
function setAuthMode(registration) {
  state.registration = registration;
  $('register-name-wrap').hidden = !registration; $('register-name').required = registration;
  $('password-help').hidden = !registration;
  $('auth-password').minLength = registration ? 12 : 1;
  $('auth-password').autocomplete = registration ? 'new-password' : 'current-password';
  $('auth-title').textContent = registration ? 'Crea tu cuenta' : 'Inicia sesión';
  $('auth-description').textContent = registration ? 'Regístrate para acceder a tu perfil personal.' : 'Accede con el correo y la contraseña de tu cuenta.';
  $('auth-submit').textContent = registration ? 'Crear mi cuenta →' : 'Entrar a mi cuenta →';
  $('switch-description').textContent = registration ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?';
  $('switch-auth').textContent = registration ? 'Iniciar sesión' : 'Crear una cuenta';
  message('auth-error', '');
}
$('switch-auth').addEventListener('click', () => setAuthMode(!state.registration));
$('show-password').addEventListener('click', () => {
  const reveal = $('auth-password').type === 'password';
  $('auth-password').type = reveal ? 'text' : 'password';
  $('show-password').textContent = reveal ? 'Ocultar' : 'Mostrar';
  $('show-password').setAttribute('aria-pressed', String(reveal));
});
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault(); message('auth-error', '');
  const email = $('auth-email').value.trim(), password = $('auth-password').value;
  if (state.registration && !passwordValid(password)) { message('auth-error', 'Usa al menos 12 caracteres y como máximo 72 bytes para la contraseña.'); return; }
  $('auth-submit').disabled = true; $('switch-auth').disabled = true;
  const generation = state.generation;
  try {
    if (state.registration) {
      await api('/auth/register', { method: 'POST', authenticated: false, body: { nombre: $('register-name').value.trim(), email, password } });
      setAuthMode(false);
      $('auth-description').textContent = 'Cuenta creada. Inicia sesión con tus credenciales.';
      $('auth-password').value = ''; $('auth-password').focus();
    } else {
      const session = await api('/auth/login', { method: 'POST', authenticated: false, body: { email, password } });
      if (generation !== state.generation) return;
      state.token = session.accessToken;
      const me = await api('/usuarios/me');
      if (generation !== state.generation) return;
      state.me = me;
      state.timer = setTimeout(() => resetSession('Tu sesión terminó. Vuelve a iniciar sesión.'), session.expiresIn * 1000);
      $('auth-password').value = ''; $('auth-view').hidden = true; $('workspace').hidden = false;
      $('account-avatar').textContent = initials(me.nombre); $('account-name').textContent = me.nombre; $('account-role').textContent = roleLabel(me.role);
      $('nav-users').hidden = me.role !== 'ADMIN';
      if (me.role === 'ADMIN') { showView('users'); await loadUsers(); } else showView('profile');
    }
  } catch (error) {
    if (!$('auth-view').hidden) { state.token = null; message('auth-error', error.message); }
    else notice(error.message, true);
  } finally { $('auth-submit').disabled = false; $('switch-auth').disabled = false; }
});
function profile(container, user, own = false) {
  container.replaceChildren();
  const head = node('div', undefined, 'profile-intro'), names = node('div');
  head.append(node('span', initials(user.nombre), 'avatar')); names.append(node('h2', user.nombre), badge(user.role)); head.append(names);
  const data = node('dl', undefined, 'profile-data');
  for (const [label, value] of [['Correo electrónico', user.email], ['Fecha de alta', date(user.createdAt)], ['Identificador de cuenta', user.id]]) data.append(node('dt', label), node('dd', value));
  container.append(head, data);
  if (own) container.append(node('p', user.role === 'ADMIN' ? 'Tu cuenta puede crear, consultar, editar y eliminar usuarios.' : 'Tu cuenta tiene acceso a este perfil. Contacta con un administrador para actualizar tu información.', 'profile-note'));
}
function showView(view) {
  $('users-view').hidden = view !== 'users'; $('profile-view').hidden = view !== 'profile';
  $('nav-users').classList.toggle('active', view === 'users'); $('nav-profile').classList.toggle('active', view === 'profile');
  if (view === 'profile') profile($('profile-card'), state.me, true);
}
$('nav-users').addEventListener('click', () => { showView('users'); loadUsers(); });
$('nav-profile').addEventListener('click', () => showView('profile'));
$('logout').addEventListener('click', () => resetSession());
function renderUsers() {
  const query = $('search').value.trim().toLocaleLowerCase('es');
  const users = state.users.filter(user => (user.nombre + ' ' + user.email).toLocaleLowerCase('es').includes(query));
  $('users-body').replaceChildren();
  for (const user of users) {
    const row = node('tr'), nameCell = node('td'), name = node('div', undefined, 'person-name');
    name.append(node('span', initials(user.nombre), 'avatar'), node('strong', user.nombre)); nameCell.append(name);
    const role = node('td'); role.append(badge(user.role));
    const actions = node('td'), wrap = node('div', undefined, 'row-actions');
    for (const [text, action] of [['Ver', () => showDetail(user)], ['Editar', () => openEditor(user)], ['Eliminar', () => openDelete(user)]]) {
      const button = node('button', text, 'row-action' + (text === 'Eliminar' ? ' delete' : ''));
      button.type = 'button'; button.setAttribute('aria-label', text + ' a ' + user.nombre);
      if (text === 'Eliminar' && user.id === state.me.id) { button.disabled = true; button.title = 'Tu propia cuenta no se puede eliminar desde esta pantalla.'; }
      button.addEventListener('click', action); wrap.append(button);
    }
    actions.append(wrap); row.append(nameCell, node('td', user.email), role, node('td', date(user.createdAt)), actions); $('users-body').append(row);
  }
  $('empty').hidden = users.length > 0;
  $('empty').textContent = query ? 'No hay coincidencias en esta página. Prueba otro nombre o correo.' : 'No hay usuarios en esta página.';
  $('count-all').textContent = state.users.length;
  $('count-admin').textContent = state.users.filter(user => user.role === 'ADMIN').length;
  $('count-user').textContent = state.users.filter(user => user.role === 'USER').length;
  $('page-label').textContent = `Página ${state.page + 1} · ${users.length} de ${state.users.length} en esta página`;
}
async function loadUsers() {
  if (!state.token || state.me?.role !== 'ADMIN') return;
  const request = ++state.listRequest, generation = state.generation;
  $('list-loading').hidden = false; message('list-error', '');
  $('previous').disabled = $('next').disabled = $('refresh').disabled = true;
  $('users-body').replaceChildren(); $('empty').hidden = true;
  try {
    let result = await api(`/usuarios?page=${state.page}&size=${state.size}`);
    if (request !== state.listRequest || generation !== state.generation) return;
    if (!result.content.length && state.page > 0) { state.page--; return await loadUsers(); }
    state.users = result.content; renderUsers();
    $('previous').disabled = state.page === 0; $('next').disabled = state.users.length < state.size;
  } catch (error) { if (request === state.listRequest) { state.users = []; message('list-error', error.message); } }
  finally { if (request === state.listRequest) { $('list-loading').hidden = true; $('refresh').disabled = false; } }
}
$('search').addEventListener('input', renderUsers);
$('refresh').addEventListener('click', loadUsers);
$('previous').addEventListener('click', () => { state.page--; $('search').value = ''; loadUsers(); });
$('next').addEventListener('click', () => { state.page++; $('search').value = ''; loadUsers(); });
async function showDetail(user) {
  const generation = state.generation;
  try { const fresh = await api('/usuarios/' + user.id); if (generation !== state.generation) return; profile($('detail-content'), fresh); $('detail').showModal(); }
  catch (error) { notice(error.message, true); }
}
function openEditor(user = null) {
  state.editing = user; $('editor-form').reset(); message('editor-error', '');
  $('edit-name').value = user?.nombre || ''; $('edit-email').value = user?.email || '';
  $('create-fields').hidden = !!user; $('edit-password').required = !user;
  $('editor-title').textContent = user ? 'Editar usuario' : 'Nuevo usuario';
  $('editor-description').textContent = user ? 'Actualiza su nombre y correo. El rol y la contraseña se conservan.' : 'Crea una cuenta y asigna su nivel de acceso.';
  $('save-user').textContent = user ? 'Guardar cambios' : 'Crear usuario';
  $('editor').showModal();
}
$('new-user').addEventListener('click', () => openEditor());
$('editor-form').addEventListener('submit', async event => {
  event.preventDefault(); message('editor-error', '');
  const editing = state.editing, generation = state.generation;
  const body = { nombre: $('edit-name').value.trim(), email: $('edit-email').value.trim() };
  if (!editing) {
    body.password = $('edit-password').value; body.role = $('edit-role').value;
    if (!passwordValid(body.password)) { message('editor-error', 'La contraseña necesita al menos 12 caracteres y como máximo 72 bytes.'); return; }
  }
  $('editor-form').dataset.busy = 'true'; $('save-user').disabled = true;
  try {
    const user = await api('/usuarios' + (editing ? '/' + editing.id : ''), { method: editing ? 'PUT' : 'POST', body });
    if (generation !== state.generation) return;
    if (user.id === state.me.id) { state.me = user; $('account-name').textContent = user.nombre; $('account-avatar').textContent = initials(user.nombre); }
    $('editor').close(); $('edit-password').value = ''; notice(editing ? 'Los cambios se guardaron correctamente.' : 'Usuario creado. Ya puede iniciar sesión.');
    await loadUsers();
  } catch (error) { message('editor-error', error.message); }
  finally { delete $('editor-form').dataset.busy; $('save-user').disabled = false; }
});
function openDelete(user) { state.deleting = user; $('delete-description').textContent = `Vas a eliminar a ${user.nombre} (${user.email}).`; message('delete-error', ''); $('delete-dialog').showModal(); }
$('delete-form').addEventListener('submit', async event => {
  event.preventDefault(); const generation = state.generation; $('confirm-delete').disabled = true; $('delete-form').dataset.busy = 'true';
  try {
    await api('/usuarios/' + state.deleting.id, { method: 'DELETE' });
    if (generation !== state.generation) return;
    $('delete-dialog').close(); notice('Usuario eliminado correctamente.'); await loadUsers();
  } catch (error) { message('delete-error', error.message); }
  finally { $('confirm-delete').disabled = false; delete $('delete-form').dataset.busy; }
});
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => {
  const dialog = button.closest('dialog'); if (!dialog.querySelector('[data-busy]')) dialog.close();
}));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('cancel', event => { if (dialog.querySelector('[data-busy]')) event.preventDefault(); }));
$('editor').addEventListener('close', () => { $('edit-password').value = ''; });
