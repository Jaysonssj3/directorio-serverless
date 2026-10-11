package com.ejemplo.usuarios.application.port.out;
import com.ejemplo.usuarios.domain.EmailNotification;
public interface NotificationPublisher { String publish(EmailNotification notification); }
