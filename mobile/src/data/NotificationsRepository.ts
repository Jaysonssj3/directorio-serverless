import type { ApiClient } from './ApiClient';
import type { NotificationInput, NotificationAccepted } from '../models/Notification';
export interface NotificationsGateway { send(input: NotificationInput): Promise<NotificationAccepted> }
export class NotificationsRepository implements NotificationsGateway {
  constructor(private api: ApiClient) {}
  send(input: NotificationInput) { return this.api.request<NotificationAccepted>('/notifications/send', { method: 'POST', body: JSON.stringify(input) }); }
}
