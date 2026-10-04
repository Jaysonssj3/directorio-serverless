package com.ejemplo.usuarios.adapter.in.web;
import com.ejemplo.usuarios.application.port.in.*;
import com.ejemplo.usuarios.application.port.out.TokenIssuer.Token;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import static com.ejemplo.usuarios.adapter.in.web.ApiDtos.*;
@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final UsuariosUseCase usuarios;
    private final AuthenticationUseCase auth;
    public AuthController(UsuariosUseCase usuarios,AuthenticationUseCase auth) { this.usuarios=usuarios; this.auth=auth; }
    @PostMapping("/register") public ResponseEntity<UsuarioResponse> register(@Valid @RequestBody RegisterRequest r) {
        var u=usuarios.register(r.nombre(),r.email(),r.password());
        return ResponseEntity.created(URI.create("/api/usuarios/me")).body(UsuarioResponse.from(u));
    }
    @PostMapping("/login") public Token login(@Valid @RequestBody LoginRequest r) { return auth.login(r.email(),r.password()); }
}
