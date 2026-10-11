package com.ejemplo.usuarios;
import com.ejemplo.usuarios.adapter.in.web.NotificationController;
import com.ejemplo.usuarios.adapter.out.notification.SnsNotificationPublisher;
import com.ejemplo.usuarios.application.service.SendNotificationService;
import com.ejemplo.usuarios.application.port.out.NotificationPublisher;
import com.ejemplo.usuarios.domain.EmailNotification;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class NotificationTest {
 @Test void validatesBeforePublishingAndReturnsAccepted() throws Exception {
   var publisher=mock(NotificationPublisher.class);
   var mvc=MockMvcBuilders.standaloneSetup(new NotificationController(new SendNotificationService(publisher))).build();
   mvc.perform(post("/notifications/send").contentType("application/json").content("{\"email\":\"bad\",\"subject\":\"\",\"message\":\"\"}")).andExpect(status().isBadRequest());
   verifyNoInteractions(publisher);
   mvc.perform(post("/notifications/send").contentType("application/json").content("{\"email\":\"demo@example.com\",\"subject\":\"Prueba\",\"message\":\"Hola\"}")).andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("QUEUED")).andExpect(jsonPath("$.notificationId").isNotEmpty());
   verify(publisher).publish(any());
 }
 @Test void publishesJsonToConfiguredTopic() throws Exception {
   var sns=mock(SnsClient.class); when(sns.publish(any(PublishRequest.class))).thenReturn(PublishResponse.builder().messageId("sns-id").build());
   var adapter=new SnsNotificationPublisher(sns,new ObjectMapper(),"arn:aws:sns:us-east-2:123456789012:topic");
   assertThat(adapter.publish(new EmailNotification("id","demo@example.com","Title","Text"))).isEqualTo("sns-id");
   var request=org.mockito.ArgumentCaptor.forClass(PublishRequest.class);verify(sns).publish(request.capture());
   assertThat(new ObjectMapper().readTree(request.getValue().message()).path("email").asText()).isEqualTo("demo@example.com");
 }
 @Test void publisherFailureDoesNotReturnSuccess() {
   var publisher=mock(NotificationPublisher.class);when(publisher.publish(any())).thenThrow(new IllegalStateException("unavailable"));
   assertThatThrownBy(()->new SendNotificationService(publisher).send("demo@example.com","Title","Text")).isInstanceOf(IllegalStateException.class);
 }
}
