package com.ejemplo.usuarios.adapter.in.web;
import com.ejemplo.usuarios.application.port.in.UsuariosUseCase;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.UUID;
import static com.ejemplo.usuarios.adapter.in.web.ApiDtos.*;
@RestController @RequestMapping("/api/usuarios")
public class UsuariosController {
    private final UsuariosUseCase usuarios;
    public UsuariosController(UsuariosUseCase usuarios) { this.usuarios=usuarios; }
    @GetMapping("/me") public UsuarioResponse me(@AuthenticationPrincipal Jwt jwt) { return UsuarioResponse.from(usuarios.get(UUID.fromString(jwt.getSubject()))); }
    @GetMapping public PageResponse list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return new PageResponse(usuarios.list(page,size).stream().map(UsuarioResponse::from).toList(),page,size);
    }
    @GetMapping("/{id}") public UsuarioResponse get(@PathVariable UUID id) { return UsuarioResponse.from(usuarios.get(id)); }
    @PostMapping public ResponseEntity<UsuarioResponse> create(@Valid @RequestBody CreateRequest r) {
        var u=usuarios.create(r.nombre(),r.email(),r.password(),r.role());
        return ResponseEntity.created(URI.create("/api/usuarios/"+u.id())).body(UsuarioResponse.from(u));
    }
    @PutMapping("/{id}") public UsuarioResponse update(@PathVariable UUID id,@Valid @RequestBody UpdateRequest r) { return UsuarioResponse.from(usuarios.update(id,r.nombre(),r.email())); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id) { usuarios.delete(id); return ResponseEntity.noContent().build(); }
}
