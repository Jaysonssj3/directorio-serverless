package com.ejemplo.usuarios.application.service;
import com.ejemplo.usuarios.application.port.in.SendNotificationUseCase;
import com.ejemplo.usuarios.application.port.out.NotificationPublisher;
import com.ejemplo.usuarios.domain.EmailNotification;
import java.util.UUID;
public class SendNotificationService implements SendNotificationUseCase {
    private final NotificationPublisher publisher;
    public SendNotificationService(NotificationPublisher publisher) { this.publisher=publisher; }
    public EmailNotification send(String email,String subject,String message) {
        var event=new EmailNotification(UUID.randomUUID().toString(),email.trim(),subject.trim(),message.trim());
        publisher.publish(event);
        return event;
    }
}
