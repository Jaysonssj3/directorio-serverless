"""Comprueba la API desplegada sin imprimir secretos ni alterar cuentas existentes."""
import base64
import json
import os
import time
import urllib.error
import urllib.request
import uuid

base = os.environ['API_URL'].rstrip('/')
if not base.startswith('https://'):
    raise SystemExit('La prueba cloud exige una URL HTTPS')

def request(method, path, body=None, token=None, content_type='application/json'):
    headers = {'Accept': '*/*'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if body is not None:
        headers['Content-Type'] = content_type
        if isinstance(body, dict):
            body = json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def expect(actual, wanted, label):
    if actual[0] != wanted:
        raise RuntimeError(f'{label}: HTTP esperado {wanted}, recibido {actual[0]}')
    print(f'OK {label}: {wanted}')
    return actual[1]

# El primer arranque Java/Neon puede tardar; solo se reintenta esta lectura sin efectos.
for attempt in range(6):
    try:
        result = request('GET', '/api/usuarios')
        if result[0] == 401:
            break
    except (urllib.error.URLError, TimeoutError):
        pass
    time.sleep(5)
else:
    raise SystemExit('La API no respondió 401; revisa Lambda y CloudWatch')
expect(result, 401, 'API protegida')

email = os.environ.get('SMOKE_ADMIN_EMAIL', '')
password = os.environ.get('SMOKE_ADMIN_PASSWORD', '')
if not email or not password:
    raise SystemExit('Faltan BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD para verificar CRUD y subida')
login = json.loads(expect(request('POST', '/api/auth/login', {'email': email, 'password': password}), 200, 'Login ADMIN'))
admin = login['accessToken']
identity = uuid.uuid4().hex
user_email = f'smoke.{identity}@example.com'
user_password = uuid.uuid4().hex + 'aA1!'
created_id = None
try:
    user = json.loads(expect(request('POST', '/api/usuarios', {'nombre': 'CI temporal', 'email': user_email, 'password': user_password, 'role': 'USER'}, admin), 201, 'Create'))
    created_id = user['id']
    expect(request('GET', f'/api/usuarios/{created_id}', token=admin), 200, 'Read')
    expect(request('PUT', f'/api/usuarios/{created_id}', {'nombre': 'CI actualizado', 'email': user_email}, admin), 200, 'Update')
    session = json.loads(expect(request('POST', '/api/auth/login', {'email': user_email, 'password': user_password}), 200, 'Login USER'))
    token = session['accessToken']
    expect(request('GET', '/api/usuarios', token=token), 403, 'Autorización USER')
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=')
    boundary = 'upload-' + identity
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="archivo"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + png + f'\r\n--{boundary}--\r\n'.encode())
    expect(request('POST', '/api/usuarios/me/avatar', multipart, token, 'multipart/form-data; boundary=' + boundary), 200, 'Upload')
    image = expect(request('GET', '/api/usuarios/me/avatar', token=token), 200, 'Read upload')
    if not image.startswith(b'\x89PNG\r\n\x1a\n'):
        raise RuntimeError('API Gateway no devolvió los bytes PNG esperados')
finally:
    if created_id:
        expect(request('DELETE', f'/api/usuarios/{created_id}', token=admin), 204, 'Delete temporal')
print('Deploy verificado: JWT, CRUD, autorización y archivo binario')
