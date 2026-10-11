package com.ejemplo.usuarios.application.port.in;
import com.ejemplo.usuarios.domain.EmailNotification;
public interface SendNotificationUseCase { EmailNotification send(String email, String subject, String message); }
