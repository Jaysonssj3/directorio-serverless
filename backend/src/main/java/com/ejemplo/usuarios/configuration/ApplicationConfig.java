package com.ejemplo.usuarios.configuration;
import com.ejemplo.usuarios.application.port.out.*;
import com.ejemplo.usuarios.application.service.UsuariosService;
import com.ejemplo.usuarios.adapter.out.security.*;
import org.springframework.context.annotation.*;
import java.time.Clock;
@Configuration
public class ApplicationConfig {
    @Bean com.ejemplo.usuarios.application.port.in.AvatarUseCase avatars(UsuarioRepository usuarios, AvatarRepository avatars, Clock clock) {
        return new com.ejemplo.usuarios.application.service.AvatarService(usuarios,avatars,new com.ejemplo.usuarios.adapter.out.files.PngImageSanitizer(),clock);
    }
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean PasswordHasher passwordHasher() { return new BcryptPasswordHasher(); }
    @Bean UsuariosService usuariosService(UsuarioRepository repository,PasswordHasher hasher,TokenIssuer issuer,Clock clock) {
        return new UsuariosService(repository,hasher,issuer,clock);
    }
}
