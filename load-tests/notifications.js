import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const vus = Number(__ENV.VUS || 10);
const duration = __ENV.DURATION || '1m';
const pause = Number(__ENV.PAUSE_SECONDS || 1);
const stress = __ENV.STRESS === 'true';
if (!Number.isInteger(vus) || vus < 1 || vus > 2000 || ![60, 120].includes(Number(__ENV.SECONDS || 60))) {
  throw new Error('Configuración de usuarios o duración inválida');
}
if (!__ENV.API_URL || !__ENV.ADMIN_TOKEN) throw new Error('Faltan API_URL y ADMIN_TOKEN');

const errors = new Rate('notification_errors');
const latency = new Trend('notification_latency', true);
const acceptedLatency = new Trend('accepted_latency', true);
const requests = new Counter('notification_requests');
const accepted = new Counter('notification_accepted');
const rejected429 = new Counter('notification_429');
const unauthorized = new Counter('notification_auth_errors');

export const options = {
  scenarios: { notifications: { executor: 'constant-vus', vus, duration, gracefulStop: '31s' } },
  summaryTrendStats: ['avg', 'min', 'max', 'p(95)', 'p(99)'],
  thresholds: {
    notification_errors: [{ threshold: 'rate<=0.05', abortOnFail: stress, delayAbortEval: '10s' }],
    notification_latency: [{ threshold: 'max<=5000', abortOnFail: stress, delayAbortEval: '10s' }],
    notification_auth_errors: [{ threshold: 'count==0', abortOnFail: true, delayAbortEval: '10s' }],
  },
};

export default function () {
  const response = http.post(`${__ENV.API_URL.replace(/\/$/, '')}/notifications/send`,
    JSON.stringify({ email: 'success@simulator.amazonses.com', subject: 'Prueba', message: 'Mensaje de carga' }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.ADMIN_TOKEN}` },
      tags: { name: 'POST /notifications/send' }, timeout: '30s', redirects: 0,
      responseCallback: http.expectedStatuses(202) });
  let id = null;
  try { id = response.json('notificationId'); } catch (_) { /* Count invalid JSON as failure. */ }
  const ok = response.status === 202 && typeof id === 'string' && id.length > 0;
  check(response, { '202 con notificationId': () => ok });
  requests.add(1);
  errors.add(!ok);
  latency.add(response.timings.duration);
  rejected429.add(response.status === 429 ? 1 : 0);
  unauthorized.add([401, 403].includes(response.status) ? 1 : 0);
  accepted.add(ok ? 1 : 0);
  if (ok) {
    acceptedLatency.add(response.timings.duration);
    console.log(`NOTIFICATION_ID=${id}`);
  }
  sleep(pause);
}

export function handleSummary(data) {
  const result = { schema: 1, config: { vus, duration, pause_seconds: pause, stress,
    email: 'success@simulator.amazonses.com', subject: 'Prueba', message: 'Mensaje de carga' }, data };
  return { [__ENV.SUMMARY_PATH || 'summary.json']: JSON.stringify(result, null, 2),
    stdout: `\nSolicitudes: ${data.metrics.notification_requests?.values.count || 0}; ` +
      `errores: ${((data.metrics.notification_errors?.values.rate || 0) * 100).toFixed(2)}%\n` };
}
