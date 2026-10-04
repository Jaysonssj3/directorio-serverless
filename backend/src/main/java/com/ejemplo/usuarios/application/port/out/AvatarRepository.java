package com.ejemplo.usuarios.application.port.out;
import com.ejemplo.usuarios.domain.Avatar;
import java.util.*;
public interface AvatarRepository {
    Optional<Avatar> find(UUID usuarioId);
    void save(Avatar avatar);
}
