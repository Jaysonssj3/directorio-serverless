"""Run one measured scenario. Credentials stay in memory and the child environment."""
import argparse
import datetime as dt
import getpass
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
SCENARIOS = {10: 60, 50: 120, 100: 120, 250: 120, 500: 120, 750: 120, 1000: 120, 1500: 120, 2000: 120}

def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def api(base, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base + path, headers=headers,
        data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vus', type=int, choices=list(SCENARIOS), default=10)
    parser.add_argument('--stress', action='store_true')
    parser.add_argument('--pause', type=float, default=1)
    parser.add_argument('--api', default='https://wk1ewnduk3.execute-api.us-east-2.amazonaws.com')
    args = parser.parse_args()
    if not args.api.startswith('https://') or not 0 <= args.pause <= 60:
        parser.error('Se requiere HTTPS y una pausa entre 0 y 60 segundos')
    binary = shutil.which('k6')
    if not binary:
        parser.error('Instala k6 y vuelve a abrir PowerShell: winget install k6 --source winget')
    print('Destinatario de pruebas SES: success@simulator.amazonses.com / Prueba / Mensaje de carga')
    print('Simulador SES: no entrega a un buzón real. Sigue aplicando la tasa máxima de envío; HTTP 202 solo confirma aceptación.')
    print('Abre las métricas AWS. Ctrl+C detiene nuevas solicitudes; SQS continúa procesando.')
    if args.stress:
        print('Detén también ante Lambda Throttles > 0 o cola visible >= 500 mensajes.')
    email = input('Correo del administrador de la aplicación: ').strip()
    password = getpass.getpass('Contraseña (no se guarda): ')
    base = args.api.rstrip('/')
    login = api(base, '/api/auth/login', {'email': email, 'password': password})
    password = None
    token = login['accessToken']
    identity = api(base, '/api/usuarios/me', token=token)
    if identity.get('role') != 'ADMIN':
        raise SystemExit('La cuenta debe tener rol ADMIN')
    # Login and identity check are outside k6 measurements. Each run gets a fresh token.
    name = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + f'-{args.vus}vu'
    output = ROOT / 'results' / name
    output.mkdir(parents=True, exist_ok=False)
    env = os.environ.copy()
    env.update(API_URL=base, ADMIN_TOKEN=token, VUS=str(args.vus),
               DURATION=f'{SCENARIOS[args.vus]}s', SECONDS=str(SCENARIOS[args.vus]),
               PAUSE_SECONDS=str(args.pause), STRESS=str(args.stress).lower(),
               SUMMARY_PATH=str(output / 'summary.json'))
    version = subprocess.check_output([binary, 'version'], text=True).strip()
    manifest = {'start_utc': utc(), 'vus': args.vus, 'planned_seconds': SCENARIOS[args.vus],
                'pause_seconds': args.pause, 'stress': args.stress, 'api_url': base,
                'k6_version': version, 'monitoring': 'AWS console, manual stop',
                'body': {'email': 'success@simulator.amazonses.com', 'subject': 'Prueba', 'message': 'Mensaje de carga'}}
    (output / 'run.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    command = [binary, 'run', '--out', f'json={output / "samples.json"}', str(ROOT / 'notifications.js')]
    started = time.monotonic()
    with (output / 'k6.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen(command, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            while process.poll() is None:
                print(f'Prueba {args.vus} usuarios: {int(time.monotonic()-started)} s', flush=True)
                time.sleep(5)
        except KeyboardInterrupt:
            # k6 shares the console and receives Ctrl+C too; give it time to write its summary.
            print('Deteniendo carga. Esperando resumen de k6...')
            try:
                process.wait(timeout=40)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=10)
            manifest['operator_stopped'] = True
    env.pop('ADMIN_TOKEN', None)
    token = None
    manifest.update(end_utc=utc(), elapsed_seconds=time.monotonic()-started, exit_code=process.returncode)
    (output / 'run.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    ids = sorted(set(re.findall(r'NOTIFICATION_ID=([a-f0-9-]{36})', (output / 'k6.log').read_text(encoding='utf-8'))))
    (output / 'notification-ids.json').write_text(json.dumps(ids, indent=2), encoding='utf-8')
    print(f'Resultados: {output}\nSalida k6: {process.returncode}. Revisa summary.json y k6.log.')
    print('Anota la recuperación desde end_utc. No inicies otra prueba con mensajes pendientes.')

if __name__ == '__main__':
    main()
