import type { LoginResponse, Page, Photo, Usuario, UsuarioInput } from '../models/Usuario';
import { ApiClient } from './ApiClient';
import { File } from 'expo-file-system';
export interface UsuariosGateway {
  me(): Promise<Usuario>;
  list(page: number): Promise<Page>;
  get(id: string): Promise<Usuario>;
  create(input: UsuarioInput): Promise<Usuario>;
  update(id: string, input: Pick<UsuarioInput, 'nombre' | 'email'>): Promise<Usuario>;
  remove(id: string): Promise<void>;
  upload(photo: Photo): Promise<void>;
}
export class UsuariosRepository implements UsuariosGateway {
  constructor(private api: ApiClient) {}
  login(email: string, password: string) {
    return this.api.request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }, false);
  }
  register(nombre: string, email: string, password: string) {
    return this.api.request<Usuario>('/api/auth/register', { method: 'POST', body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), password }) }, false);
  }
  me() { return this.api.request<Usuario>('/api/usuarios/me'); }
  list(page: number) { return this.api.request<Page>(`/api/usuarios?page=${page}&size=10`); }
  get(id: string) { return this.api.request<Usuario>(`/api/usuarios/${encodeURIComponent(id)}`); }
  create(input: UsuarioInput) { return this.api.request<Usuario>('/api/usuarios', { method: 'POST', body: JSON.stringify(input) }); }
  update(id: string, input: Pick<UsuarioInput, 'nombre' | 'email'>) {
    return this.api.request<Usuario>(`/api/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
  }
  remove(id: string) { return this.api.request<void>(`/api/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async upload(photo: Photo) {
    const body = new FormData();
    // Expo 57 usa expo/fetch: necesita los bytes de File, no el objeto URI de RN.
    const file = new File(photo.uri);
    if (!file.exists || file.size === 0) throw new Error('No se pudo leer la foto. Selecciónala de nuevo.');
    if (file.size > 2 * 1024 * 1024) throw new Error('La foto supera el límite de 2 MB. Selecciona una imagen más pequeña.');
    body.append('archivo', file);
    await this.api.request('/api/usuarios/me/avatar', { method: 'POST', body });
  }
}
