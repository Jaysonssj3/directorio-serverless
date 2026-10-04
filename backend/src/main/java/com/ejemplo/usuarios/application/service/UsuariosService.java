package com.ejemplo.usuarios.application.service;
import com.ejemplo.usuarios.application.port.in.*;
import com.ejemplo.usuarios.application.port.out.*;
import com.ejemplo.usuarios.domain.*;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;
import static com.ejemplo.usuarios.domain.BusinessException.Kind.*;

/** Casos de uso sin dependencias de Spring, HTTP, SQL o JWT. */
public final class UsuariosService implements UsuariosUseCase, AuthenticationUseCase {
    private final UsuarioRepository repository;
    private final PasswordHasher passwords;
    private final TokenIssuer tokens;
    private final Clock clock;
    private final String dummyHash;
    public UsuariosService(UsuarioRepository repository, PasswordHasher passwords, TokenIssuer tokens, Clock clock) {
        this.repository=repository; this.passwords=passwords; this.tokens=tokens; this.clock=clock;
        this.dummyHash=passwords.hash(UUID.randomUUID().toString());
    }
    public static String normalizeEmail(String email) { return email.trim().toLowerCase(Locale.ROOT); }
    public static void validatePassword(String password) {
        if (password == null || password.isBlank() || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new BusinessException(INVALID, "La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8");
    }
    private static void validateProfile(String nombre, String email) {
        if (nombre == null || nombre.isBlank() || nombre.length() > 100 || email == null || email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
            throw new BusinessException(INVALID, "Nombre o email inválidos");
    }
    @Override public Usuario register(String nombre, String email, String password) { return create(nombre,email,password,Role.USER); }
    @Override public Usuario create(String nombre, String email, String password, Role role) {
        validateProfile(nombre,email); validatePassword(password);
        if(role == null) throw new BusinessException(INVALID, "Rol obligatorio");
        return repository.insert(new Usuario(UUID.randomUUID(),nombre.trim(),normalizeEmail(email),passwords.hash(password),role,clock.instant()));
    }
    @Override public Usuario get(UUID id) { return repository.findById(id).orElseThrow(() -> new BusinessException(NOT_FOUND,"Usuario no encontrado")); }
    @Override public List<Usuario> list(int page, int size) {
        if(page<0 || page>1000000 || size<1 || size>100) throw new BusinessException(INVALID,"Paginación inválida");
        return repository.findPage(page,size);
    }
    @Override public Usuario update(UUID id, String nombre, String email) {
        validateProfile(nombre,email);
        return repository.updateProfile(id,nombre.trim(),normalizeEmail(email));
    }
    @Override public void delete(UUID id) { repository.delete(id); }
    @Override public TokenIssuer.Token login(String email, String password) {
        var usuario=repository.findByEmail(normalizeEmail(email));
        boolean valid = passwords.matches(password,usuario.map(Usuario::passwordHash).orElse(dummyHash));
        if(usuario.isEmpty() || !valid) throw new BusinessException(UNAUTHORIZED,"Credenciales inválidas");
        return tokens.issue(usuario.get());
    }
}
