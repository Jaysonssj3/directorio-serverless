import { Observable, message } from './Observable';
import type { UsuariosGateway } from '../data/UsuariosRepository';
import type { Photo, Usuario, UsuarioInput } from '../models/Usuario';
interface State {
  profile: Usuario; users: Usuario[]; page: number; hasNext: boolean;
  loading: boolean; saving: boolean; error: string; notice: string;
  selected: Usuario | null; photoVersion: number;
  profileMs: number; listMs: number; totalMs: number; profileError: string; listError: string;
}
export class UsuariosViewModel extends Observable<State> {
  private sequence = 0;
  constructor(private repo: UsuariosGateway, user: Usuario) {
    super({ profile: user, users: [], page: 0, hasNext: false, loading: false, saving: false,
      error: '', notice: '', selected: null, photoVersion: Date.now(), profileMs: 0, listMs: 0, totalMs: 0, profileError: '', listError: '' });
  }
  async load(page = this.state.page) {
    const sequence = ++this.sequence;
    const start = Date.now();
    this.set({ loading: true, error: '', profileError: '', listError: '' });
    let profileMs = 0, listMs = 0;
    // Ambas peticiones empiezan antes del await. allSettled conserva resultados parciales.
    const profileTask = this.repo.me().finally(() => { profileMs = Date.now() - start; });
    const listTask = this.state.profile.role === 'ADMIN'
      ? this.repo.list(page).finally(() => { listMs = Date.now() - start; })
      : Promise.resolve(null);
    const [profile, list] = await Promise.allSettled([profileTask, listTask]);
    if (sequence !== this.sequence) return;
    this.set({ loading: false, profileMs, listMs, totalMs: Date.now() - start,
      ...(profile.status === 'fulfilled' ? { profile: profile.value } : { profileError: message(profile.reason) }),
      ...(list.status === 'fulfilled' && list.value ? { users: list.value.content, page, hasNext: list.value.content.length === 10 }
        : list.status === 'rejected' ? { listError: message(list.reason) } : {}) });
  }
  async select(id: string) {
    if (this.state.saving) return;
    this.set({ saving: true, error: '', notice: '', selected: null });
    try { this.set({ selected: await this.repo.get(id) }); }
    catch (e) { this.set({ error: message(e) }); }
    finally { this.set({ saving: false }); }
  }
  clearSelection() { this.set({ selected: null, error: '', notice: '' }); }
  async save(input: UsuarioInput, id?: string): Promise<boolean> {
    if (this.state.saving) return false;
    this.set({ saving: true, error: '', notice: '' });
    try {
      if (!input.nombre.trim() || !/^\S+@\S+\.\S+$/.test(input.email.trim())) throw new Error('Completa el nombre y un correo válido.');
      if (!id && input.password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
      const fields = { ...input, nombre: input.nombre.trim(), email: input.email.trim() };
      if (id) await this.repo.update(id, { nombre: fields.nombre, email: fields.email });
      else await this.repo.create(fields);
      this.set({ selected: null, notice: id ? 'Usuario actualizado.' : 'Usuario creado.' });
      await this.load(id ? this.state.page : 0);
      return true;
    } catch (e) { this.set({ error: message(e) }); return false; }
    finally { this.set({ saving: false }); }
  }
  async remove(id: string) {
    if (this.state.saving) return;
    this.set({ saving: true, error: '', notice: '' });
    try {
      if (id === this.state.profile.id) throw new Error('Desde la app no puedes eliminar tu propia cuenta administradora.');
      await this.repo.remove(id);
      this.set({ selected: null, notice: 'Usuario eliminado.' });
      await this.load(this.state.users.length === 1 ? Math.max(0, this.state.page - 1) : this.state.page);
    } catch (e) { this.set({ error: message(e) }); }
    finally { this.set({ saving: false }); }
  }
  async upload(picker: () => Promise<Photo | null>) {
    if (this.state.saving) return;
    this.set({ saving: true, error: '', notice: '' });
    try {
      const photo = await picker();
      if (!photo) return;
      await this.repo.upload(photo);
      this.set({ photoVersion: Date.now(), notice: 'Foto guardada en PostgreSQL.' });
    } catch (e) { this.set({ error: message(e) }); }
    finally { this.set({ saving: false }); }
  }
}
