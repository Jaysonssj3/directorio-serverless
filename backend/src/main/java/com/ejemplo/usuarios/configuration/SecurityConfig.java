package com.ejemplo.usuarios.configuration;
import com.ejemplo.usuarios.application.port.out.*;
import com.ejemplo.usuarios.adapter.out.security.JwtTokenIssuer;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.*;
import java.util.*;

@Configuration
public class SecurityConfig {
    @Bean SecretKey jwtKey(@Value("${app.jwt.secret}") String base64) {
        byte[] bytes=Base64.getDecoder().decode(base64);
        if(bytes.length<32) throw new IllegalArgumentException("JWT_SECRET debe contener al menos 32 bytes aleatorios en Base64");
        return new SecretKeySpec(bytes,"HmacSHA256");
    }
    @Bean JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder jwtDecoder(SecretKey key,@Value("${app.jwt.issuer}") String issuer) {
        var decoder=NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> audience=jwt -> jwt.getAudience().contains("usuarios-api") && jwt.getExpiresAt()!=null
            ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token","Token inválido",null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer),audience));
        return decoder;
    }
    @Bean TokenIssuer tokenIssuer(JwtEncoder encoder,Clock clock,@Value("${app.jwt.issuer}") String issuer,@Value("${app.jwt.ttl}") Duration ttl) {
        if(ttl.isNegative() || ttl.isZero() || ttl.compareTo(Duration.ofHours(1))>0) throw new IllegalArgumentException("TTL debe ser mayor que cero y como máximo una hora");
        return new JwtTokenIssuer(encoder,clock,issuer,ttl);
    }
    @Bean SecurityFilterChain securityFilterChain(HttpSecurity http,UsuarioRepository repository) throws Exception {
        http.csrf(csrf->csrf.disable())
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(c->c.disable())
            .headers(h->h.contentSecurityPolicy(c->c.policyDirectives("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")))
            .authorizeHttpRequests(a->a
                .requestMatchers(HttpMethod.GET,"/","/index.html","/app.css","/app.js").permitAll()
                .requestMatchers(HttpMethod.POST,"/api/auth/register","/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET,"/api/usuarios/me").authenticated()
                .requestMatchers(HttpMethod.GET,"/api/usuarios/me/avatar").authenticated()
                .requestMatchers(HttpMethod.POST,"/api/usuarios/me/avatar").authenticated()
                .requestMatchers("/api/usuarios","/api/usuarios/**").hasRole("ADMIN")
                .anyRequest().denyAll())
            .exceptionHandling(e->e
                .authenticationEntryPoint((req,res,ex)->{ res.setStatus(401); res.setHeader("WWW-Authenticate","Bearer"); res.setCharacterEncoding("UTF-8"); res.setContentType("application/problem+json"); res.getWriter().write("{\"status\":401,\"title\":\"Autenticación requerida\"}"); })
                .accessDeniedHandler((req,res,ex)->{ res.setStatus(403); res.setCharacterEncoding("UTF-8"); res.setContentType("application/problem+json"); res.getWriter().write("{\"status\":403,\"title\":\"Acceso denegado\"}"); }))
            .oauth2ResourceServer(o->o
                .authenticationEntryPoint((req,res,ex)->{ res.setStatus(401); res.setHeader("WWW-Authenticate","Bearer error=\"invalid_token\""); res.setCharacterEncoding("UTF-8"); res.setContentType("application/problem+json"); res.getWriter().write("{\"status\":401,\"title\":\"Token inválido o vencido\"}"); })
                .jwt(j->j.jwtAuthenticationConverter(jwt->{
                    try {
                        var u=repository.findById(UUID.fromString(jwt.getSubject())).orElseThrow(()->new IllegalArgumentException("Usuario inexistente"));
                        return new JwtAuthenticationToken(jwt,List.of(new SimpleGrantedAuthority("ROLE_"+u.role().name())));
                    } catch(IllegalArgumentException ex) {
                        throw new OAuth2AuthenticationException(new OAuth2Error("invalid_token"));
                    }
                })));
        return http.build();
    }
}
