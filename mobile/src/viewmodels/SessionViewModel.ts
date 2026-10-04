import { Observable, message } from './Observable';
import { ApiClient, normalizeUrl } from '../data/ApiClient';
import type { UsuariosRepository } from '../data/UsuariosRepository';
import type { SessionStorage } from '../data/SessionStore';
import type { Session, Usuario } from '../models/Usuario';
interface State { ready: boolean; busy: boolean; user: Usuario | null; error: string; baseUrl: string }
export class SessionViewModel extends Observable<State> {
  private session: Session | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private storageQueue = Promise.resolve();
  constructor(private api: ApiClient, private repo: Pick<UsuariosRepository, 'login' | 'register' | 'me'>, private storage: SessionStorage) {
    super({ ready: false, busy: false, user: null, error: '', baseUrl: api.baseUrl });
    api.onUnauthorized = () => { void this.logout('Tu sesión terminó. Inicia sesión de nuevo.'); };
  }
  private persist(s: Session | null) {
    this.storageQueue = this.storageQueue.catch(() => {}).then(() => this.storage.write(s));
    return this.storageQueue;
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.session) this.timer = setTimeout(() => { void this.logout('La sesión venció.'); }, Math.max(0, this.session.expiresAt - Date.now()));
  }
  async restore() {
    try {
      const savedUrl = await this.storage.readUrl();
      if (savedUrl) this.api.baseUrl = normalizeUrl(savedUrl);
      this.set({ baseUrl: this.api.baseUrl });
      const session = await this.storage.read();
      if (session && session.expiresAt > Date.now() && session.baseUrl === this.api.baseUrl) {
        this.session = session; this.api.token = session.accessToken; this.schedule();
        const user = await this.repo.me();
        if (this.session === session) this.set({ user });
      } else await this.persist(null);
    } catch (e) { await this.logout(message(e)); }
    finally { this.set({ ready: true }); }
  }
  async login(url: string, email: string, password: string, nombre?: string) {
    if (this.state.busy) return;
    this.set({ busy: true, error: '' });
    try {
      this.api.baseUrl = normalizeUrl(url);
      this.api.token = null;
      await this.storage.writeUrl(this.api.baseUrl);
      this.set({ baseUrl: this.api.baseUrl });
      if (nombre !== undefined) await this.repo.register(nombre, email, password);
      const token = await this.repo.login(email, password);
      const session = { accessToken: token.accessToken, expiresAt: Date.now() + token.expiresIn * 1000, baseUrl: this.api.baseUrl };
      this.session = session; this.api.token = session.accessToken;
      await this.persist(session);
      this.schedule();
      const user = await this.repo.me();
      if (this.session === session) this.set({ user });
    } catch (e) { await this.logout(message(e)); }
    finally { this.set({ busy: false }); }
  }
  async logout(error = '') {
    clearTimeout(this.timer); this.session = null; this.api.token = null;
    this.set({ user: null, error });
    try { await this.persist(null); } catch { this.set({ error: 'Sesión cerrada, pero no se pudo borrar el almacenamiento. Borra los datos de la app.' }); }
  }
  checkExpiry() { if (this.session && Date.now() >= this.session.expiresAt) void this.logout('La sesión venció.'); }
}
