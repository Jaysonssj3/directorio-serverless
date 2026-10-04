import * as SecureStore from 'expo-secure-store';
import type { Session } from '../models/Usuario';
export interface SessionStorage {
  read(): Promise<Session | null>;
  write(session: Session | null): Promise<void>;
  readUrl(): Promise<string | null>;
  writeUrl(url: string): Promise<void>;
}
export class SessionStore implements SessionStorage {
  async read(): Promise<Session | null> {
    const raw = await SecureStore.getItemAsync('directorio.session');
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Session;
      return typeof s.accessToken === 'string' && typeof s.expiresAt === 'number' && typeof s.baseUrl === 'string' ? s : null;
    } catch { return null; }
  }
  async write(session: Session | null) {
    if (session) await SecureStore.setItemAsync('directorio.session', JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync('directorio.session');
  }
  readUrl() { return SecureStore.getItemAsync('directorio.server'); }
  async writeUrl(url: string) { await SecureStore.setItemAsync('directorio.server', url); }
}
