package com.ejemplo.usuarios.adapter.in.web;
import com.ejemplo.usuarios.domain.*;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
public final class ApiDtos {
    private ApiDtos() {}
    public record RegisterRequest(@NotBlank @Size(max=100) String nombre,@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(min=12,max=72) String password) {
        @AssertTrue(message="La contraseña no puede superar 72 bytes UTF-8") public boolean isPasswordWithinBytes() { return password==null || password.getBytes(StandardCharsets.UTF_8).length<=72; }
        @Override public String toString() { return "RegisterRequest[REDACTED]"; }
    }
    public record CreateRequest(@NotBlank @Size(max=100) String nombre,@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(min=12,max=72) String password,@NotNull Role role) {
        @AssertTrue(message="La contraseña no puede superar 72 bytes UTF-8") public boolean isPasswordWithinBytes() { return password==null || password.getBytes(StandardCharsets.UTF_8).length<=72; }
        @Override public String toString() { return "CreateRequest[REDACTED]"; }
    }
    public record LoginRequest(@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(max=72) String password) {
        @AssertTrue(message="La contraseña no puede superar 72 bytes UTF-8") public boolean isPasswordWithinBytes() { return password==null || password.getBytes(StandardCharsets.UTF_8).length<=72; }
        @Override public String toString() { return "LoginRequest[REDACTED]"; }
    }
    public record UpdateRequest(@NotBlank @Size(max=100) String nombre,@NotBlank @Email @Size(max=254) String email) {}
    public record UsuarioResponse(UUID id,String nombre,String email,Role role,Instant createdAt) {
        public static UsuarioResponse from(Usuario u) { return new UsuarioResponse(u.id(),u.nombre(),u.email(),u.role(),u.createdAt()); }
    }
    public record PageResponse(List<UsuarioResponse> content,int page,int size) {}
}
