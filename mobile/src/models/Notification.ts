export interface NotificationInput { email: string; subject: string; message: string }
export interface NotificationAccepted { notificationId: string; status: 'QUEUED'; message: string }
