package com.ejemplo.usuarios.adapter.in.web;
import com.ejemplo.usuarios.application.port.in.SendNotificationUseCase;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
public class NotificationController {
    private final SendNotificationUseCase service;
    public NotificationController(SendNotificationUseCase service) { this.service=service; }
    public record Request(@NotBlank @Email @Size(max=254) String email,
        @NotBlank @Size(max=150) @Pattern(regexp="[^\r\n]*") String subject,
        @NotBlank @Size(max=5000) String message) {}
    public record Accepted(String notificationId,String status,String message) {}
    @PostMapping({"/notifications/send","/api/notifications/send"})
    public ResponseEntity<Accepted> send(@Valid @RequestBody Request request) {
        var event=service.send(request.email(),request.subject(),request.message());
        return ResponseEntity.accepted().body(new Accepted(event.notificationId(),"QUEUED","Mensaje enviado correctamente."));
    }
}
