export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function normalizeUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Escribe una URL como http://192.168.1.20:8080'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Usa solamente el servidor y puerto, sin /api, credenciales ni parámetros.');
  }
  // HTTP se admite para una demostración en red local; servidores públicos requieren TLS.
  const local = /^(localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|127\.\d+\.\d+\.\d+)$/.test(url.hostname);
  if (url.protocol === 'http:' && !local) throw new Error('Para un servidor público utiliza HTTPS.');
  return url.origin;
}
export class ApiClient {
  baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8080';
  token: string | null = null;
  onUnauthorized: () => void = () => {};
  constructor(private transport: typeof fetch = fetch, private timeoutMs = 35000) {}
  async request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const usedToken = auth ? this.token : null;
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (usedToken) headers.set('Authorization', `Bearer ${usedToken}`);
    if (typeof options.body === 'string') headers.set('Content-Type', 'application/json');
    try {
      const response = await this.transport(this.baseUrl + path, { ...options, headers, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 401 && auth && usedToken === this.token) this.onUnauthorized();
        const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string; errors?: string[] };
        throw new ApiError(response.status, problem.errors?.join('\n') || problem.detail || problem.title || `Error HTTP ${response.status}`);
      }
      if (response.status === 204) return undefined as T;
      try { return await response.json() as T; }
      catch { throw new ApiError(response.status, 'La API respondió, pero el formato de la respuesta no es válido.'); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new Error('El servidor tardó demasiado. Intenta de nuevo.');
      if (error instanceof Error && /Unsupported FormData|FormDataPart/i.test(error.message)) {
        throw new Error('No se pudo preparar el archivo para enviarlo. Recarga la app y selecciona la foto de nuevo.');
      }
      throw new Error('No se pudo conectar. Revisa la dirección, el backend y la red Wi-Fi.');
    } finally { clearTimeout(timeout); }
  }
}
