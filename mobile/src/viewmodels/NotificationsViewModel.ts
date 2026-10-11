import { Observable } from './Observable';
import type { NotificationsGateway } from '../data/NotificationsRepository';
import type { NotificationInput } from '../models/Notification';
interface State extends NotificationInput { sending: boolean; error: string; notice: string; notificationId: string }
export class NotificationsViewModel extends Observable<State> {
  constructor(private repo: NotificationsGateway) { super({ email: '', subject: '', message: '', sending: false, error: '', notice: '', notificationId: '' }); }
  change(field: keyof NotificationInput, value: string) { if (!this.state.sending) this.set({ [field]: value, error: '', notice: '', notificationId: '' }); }
  async send() {
    if (this.state.sending) return;
    const input = { email: this.state.email.trim(), subject: this.state.subject.trim(), message: this.state.message.trim() };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254 || !input.subject || input.subject.length > 150 || /[\r\n]/.test(input.subject) || !input.message || input.message.length > 5000) {
      this.set({ error: 'Revisa el correo, el asunto (máximo 150 caracteres) y el mensaje (máximo 5000).', notice: '' }); return;
    }
    this.set({ sending: true, error: '', notice: '', notificationId: '' });
    try {
      const result = await this.repo.send(input);
      this.set({ notice: 'Mensaje enviado correctamente.', notificationId: result.notificationId });
    } catch { this.set({ error: 'Error al enviar mensaje.' }); }
    finally { this.set({ sending: false }); }
  }
}
