package com.ejemplo.usuarios.adapter.out.notification;
import com.ejemplo.usuarios.application.port.out.NotificationPublisher;
import com.ejemplo.usuarios.domain.EmailNotification;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import org.slf4j.LoggerFactory;
public class SnsNotificationPublisher implements NotificationPublisher {
    private final SnsClient sns; private final ObjectMapper json; private final String topic;
    public SnsNotificationPublisher(SnsClient sns,ObjectMapper json,String topic) { this.sns=sns;this.json=json;this.topic=topic; }
    public String publish(EmailNotification event) {
        try {
            var result=sns.publish(PublishRequest.builder().topicArn(topic).message(json.writeValueAsString(event)).build());
            LoggerFactory.getLogger(getClass()).info("notification_published notificationId={} snsMessageId={}",event.notificationId(),result.messageId());
            return result.messageId();
        } catch(Exception e) {
            LoggerFactory.getLogger(getClass()).warn("notification_publish_failed notificationId={} type={}",event.notificationId(),e.getClass().getSimpleName());
            throw new IllegalStateException("No se pudo publicar la notificación");
        }
    }
}
