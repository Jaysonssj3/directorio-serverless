package com.ejemplo.usuarios.application.port.out;
public interface PasswordHasher {
    String hash(String raw);
    boolean matches(String raw, String encoded);
}
