package com.ejemplo.usuarios.adapter.in.web;
import com.ejemplo.usuarios.application.port.in.AvatarUseCase;
import com.ejemplo.usuarios.domain.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
@RestController @RequestMapping("/api/usuarios")
public class AvatarController {
    private final AvatarUseCase avatars;
    public AvatarController(AvatarUseCase avatars) { this.avatars=avatars; }
    public record UploadResponse(UUID usuarioId,int bytes,String contentType,Instant actualizado) {}
    @GetMapping("/me/avatar") public ResponseEntity<byte[]> mine(@AuthenticationPrincipal Jwt jwt) { return image(UUID.fromString(jwt.getSubject())); }
    @PostMapping(value="/me/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadResponse uploadMine(@AuthenticationPrincipal Jwt jwt,@RequestParam("archivo") MultipartFile file) throws IOException { return save(UUID.fromString(jwt.getSubject()),file); }
    @GetMapping("/{id}/avatar") public ResponseEntity<byte[]> image(@PathVariable UUID id) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore()).body(avatars.get(id).contenido());
    }
    @PostMapping(value="/{id}/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadResponse save(@PathVariable UUID id,@RequestParam("archivo") MultipartFile file) throws IOException {
        if(file.getSize()>2*1024*1024) throw new org.springframework.web.multipart.MaxUploadSizeExceededException(2*1024*1024);
        var a=avatars.save(id,file.getBytes());
        return new UploadResponse(a.usuarioId(),a.contenido().length,"image/png",a.actualizado());
    }
}
