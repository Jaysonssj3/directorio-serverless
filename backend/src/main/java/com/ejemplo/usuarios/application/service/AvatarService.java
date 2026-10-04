package com.ejemplo.usuarios.application.service;
import com.ejemplo.usuarios.application.port.in.AvatarUseCase;
import com.ejemplo.usuarios.application.port.out.*;
import com.ejemplo.usuarios.domain.*;
import java.time.Clock;
import java.util.UUID;
import static com.ejemplo.usuarios.domain.BusinessException.Kind.*;
public class AvatarService implements AvatarUseCase {
    private final UsuarioRepository usuarios;
    private final AvatarRepository avatars;
    private final ImageSanitizer images;
    private final Clock clock;
    public AvatarService(UsuarioRepository usuarios, AvatarRepository avatars, ImageSanitizer images, Clock clock) {
        this.usuarios=usuarios; this.avatars=avatars; this.images=images; this.clock=clock;
    }
    public Avatar get(UUID id) {
        return avatars.find(id).orElseThrow(()->new BusinessException(NOT_FOUND,"No hay foto de perfil"));
    }
    public Avatar save(UUID id, byte[] archivo) {
        if(usuarios.findById(id).isEmpty()) throw new BusinessException(NOT_FOUND,"Usuario inexistente");
        if(archivo.length==0 || archivo.length>2*1024*1024) throw new BusinessException(INVALID,"La imagen debe ocupar entre 1 byte y 2 MB");
        var avatar=new Avatar(id,images.toSafePng(archivo),clock.instant());
        avatars.save(avatar);
        return avatar;
    }
}
