package com.ejemplo.usuarios.application.port.out;
import com.ejemplo.usuarios.domain.Usuario;
public interface TokenIssuer {
    record Token(String accessToken, String tokenType, long expiresIn) {}
    Token issue(Usuario usuario);
}
