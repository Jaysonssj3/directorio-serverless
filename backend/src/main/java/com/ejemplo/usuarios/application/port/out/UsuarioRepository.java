package com.ejemplo.usuarios.application.port.out;
import com.ejemplo.usuarios.domain.Usuario;
import java.util.*;
public interface UsuarioRepository {
    Optional<Usuario> findById(UUID id);
    Optional<Usuario> findByEmail(String email);
    List<Usuario> findPage(int page, int size);
    Usuario insert(Usuario usuario);
    Usuario updateProfile(UUID id, String nombre, String email);
    void delete(UUID id);
}
