package com.ejemplo.usuarios.adapter.out.security;
import com.ejemplo.usuarios.application.port.out.TokenIssuer;
import com.ejemplo.usuarios.domain.Usuario;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import java.time.*;
import java.util.UUID;
public final class JwtTokenIssuer implements TokenIssuer {
    private final JwtEncoder encoder;
    private final Clock clock;
    private final String issuer;
    private final Duration ttl;
    public JwtTokenIssuer(JwtEncoder encoder, Clock clock, String issuer, Duration ttl) {
        this.encoder=encoder; this.clock=clock; this.issuer=issuer; this.ttl=ttl;
    }
    @Override public Token issue(Usuario u) {
        var now=clock.instant();
        var claims=JwtClaimsSet.builder().issuer(issuer).subject(u.id().toString()).audience(java.util.List.of("usuarios-api"))
            .issuedAt(now).expiresAt(now.plus(ttl)).id(UUID.randomUUID().toString()).build();
        var header=JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        return new Token(encoder.encode(JwtEncoderParameters.from(header,claims)).getTokenValue(),"Bearer",ttl.toSeconds());
    }
}
