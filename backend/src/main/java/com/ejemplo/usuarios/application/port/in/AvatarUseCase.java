package com.ejemplo.usuarios.application.port.in;
import com.ejemplo.usuarios.domain.Avatar;
import java.util.UUID;
public interface AvatarUseCase {
    Avatar get(UUID usuarioId);
    Avatar save(UUID usuarioId, byte[] archivo);
}
