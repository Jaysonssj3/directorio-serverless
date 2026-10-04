package com.ejemplo.usuarios.domain;
import java.time.Instant;
import java.util.UUID;
/** Modelo interno: nunca serializar como respuesta HTTP. */
public record Usuario(UUID id, String nombre, String email, String passwordHash, Role role, Instant createdAt) {
    @Override public String toString() { return "Usuario[id=" + id + ", role=" + role + "]"; }
}
