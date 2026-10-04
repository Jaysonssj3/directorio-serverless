package com.ejemplo.usuarios.configuration;
import com.ejemplo.usuarios.application.port.in.UsuariosUseCase;
import com.ejemplo.usuarios.application.port.out.UsuarioRepository;
import com.ejemplo.usuarios.application.service.UsuariosService;
import com.ejemplo.usuarios.domain.Role;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

@Configuration
@ConditionalOnProperty(name="app.bootstrap.enabled",havingValue="true")
public class AdminBootstrap {
    @Bean ApplicationRunner bootstrap(UsuariosUseCase useCase,UsuarioRepository repository,
        @Value("${app.bootstrap.email}") String email,@Value("${app.bootstrap.password}") String password) {
        return args->{
            var existing=repository.findByEmail(UsuariosService.normalizeEmail(email));
            if(existing.isEmpty()) useCase.create("Administrador",email,password,Role.ADMIN);
            else if(existing.get().role()!=Role.ADMIN) throw new IllegalStateException("El email de bootstrap pertenece a un usuario no administrador");
        };
    }
}
