package com.ejemplo.usuarios.domain;
import java.time.Instant;
import java.util.UUID;
public record Avatar(UUID usuarioId, byte[] contenido, Instant actualizado) {
    public Avatar { contenido = contenido.clone(); }
    @Override public byte[] contenido() { return contenido.clone(); }
}
