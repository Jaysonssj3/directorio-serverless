package com.ejemplo.usuarios.application.port.in;
import com.ejemplo.usuarios.application.port.out.TokenIssuer.Token;
public interface AuthenticationUseCase {
    Token login(String email, String password);
}
