package com.ejemplo.usuarios.adapter.out.security;
import com.ejemplo.usuarios.application.port.out.PasswordHasher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
public final class BcryptPasswordHasher implements PasswordHasher {
    private final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder(12);
    @Override public String hash(String raw) { return encoder.encode(raw); }
    @Override public boolean matches(String raw,String encoded) { return encoder.matches(raw,encoded); }
}
