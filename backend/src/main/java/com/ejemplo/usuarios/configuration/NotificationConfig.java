package com.ejemplo.usuarios.configuration;
import com.ejemplo.usuarios.application.port.in.SendNotificationUseCase;
import com.ejemplo.usuarios.application.port.out.NotificationPublisher;
import com.ejemplo.usuarios.application.service.SendNotificationService;
import com.ejemplo.usuarios.adapter.out.notification.SnsNotificationPublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;
import java.time.Duration;
@Configuration
public class NotificationConfig {
    @Bean(destroyMethod="close") SnsClient snsClient(@Value("${AWS_REGION:us-east-2}") String region) {
        return SnsClient.builder().region(Region.of(region)).overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(8)).apiCallAttemptTimeout(Duration.ofSeconds(3))).build();
    }
    @Bean NotificationPublisher notificationPublisher(SnsClient sns,ObjectMapper json,@Value("${NOTIFICATIONS_TOPIC_ARN:}") String topic) {
        if(topic.isBlank()) return event -> { throw new IllegalStateException("Notificaciones no configuradas"); };
        return new SnsNotificationPublisher(sns,json,topic);
    }
    @Bean SendNotificationUseCase sendNotificationUseCase(NotificationPublisher publisher) { return new SendNotificationService(publisher); }
}
