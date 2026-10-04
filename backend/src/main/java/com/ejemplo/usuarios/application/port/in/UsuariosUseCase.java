package com.ejemplo.usuarios.application.port.in;
import com.ejemplo.usuarios.domain.*;
import java.util.*;
public interface UsuariosUseCase {
    Usuario register(String nombre, String email, String password);
    Usuario create(String nombre, String email, String password, Role role);
    Usuario get(UUID id);
    List<Usuario> list(int page, int size);
    Usuario update(UUID id, String nombre, String email);
    void delete(UUID id);
}
