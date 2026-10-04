package com.ejemplo.usuarios;

import com.ejemplo.usuarios.application.port.in.UsuariosUseCase;
import com.ejemplo.usuarios.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Ejecuta HTTP, seguridad real, casos de uso, SQL y Flyway en el mismo contexto. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UsuariosUseCase usuarios;
    @Autowired JwtEncoder encoder;
    private static final String PASSWORD="UnaClaveLarga123!";

    @BeforeEach void reset() { jdbc.update("DELETE FROM usuarios"); }
    @Test void browserAssetsArePublicButApiStillRequiresAuthentication() throws Exception {
        for(String path:List.of("/","/index.html","/app.css","/app.js")) {
            mvc.perform(get(path)).andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy",org.hamcrest.Matchers.containsString("script-src 'self'")));
        }
        mvc.perform(get("/api/usuarios")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("title").value("Autenticación requerida"));
        mvc.perform(get("/application.yml")).andExpect(status().isUnauthorized());
    }
    private String body(Object value) throws Exception { return json.writeValueAsString(value); }
    private JsonNode register(String email) throws Exception {
        var result=mvc.perform(post("/api/auth/register").contentType("application/json")
            .content(body(Map.of("nombre","Ana","email",email,"password",PASSWORD))))
            .andExpect(status().isCreated()).andExpect(jsonPath("passwordHash").doesNotExist())
            .andExpect(jsonPath("password").doesNotExist()).andExpect(jsonPath("role").value("USER")).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    private String login(String email) throws Exception {
        var result=mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(body(Map.of("email",email,"password",PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("tokenType").value("Bearer"))
            .andExpect(jsonPath("expiresIn").value(900)).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
    private String admin() throws Exception {
        usuarios.create("Admin","admin@example.com",PASSWORD,Role.ADMIN);
        return login("admin@example.com");
    }
    @Test void registerLoginAndMeUseRealBcryptAndJwt() throws Exception {
        var u=register("Ana@Example.com");
        assertThat(u.get("email").asText()).isEqualTo("ana@example.com");
        var hash=jdbc.queryForObject("SELECT password_hash FROM usuarios WHERE email=?",String.class,"ana@example.com");
        assertThat(hash).startsWith("$2a$12$").doesNotContain(PASSWORD);
        mvc.perform(get("/api/usuarios/me").header("Authorization","Bearer "+login("ana@example.com")))
            .andExpect(status().isOk()).andExpect(jsonPath("id").value(u.get("id").asText()))
            .andExpect(jsonPath("passwordHash").doesNotExist());
    }
    @Test void anonymousAndRegularUserCannotManageOthers() throws Exception {
        mvc.perform(get("/api/usuarios")).andExpect(status().isUnauthorized());
        register("ana@example.com");
        String token=login("ana@example.com");
        mvc.perform(get("/api/usuarios").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/usuarios/"+UUID.randomUUID()).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/usuarios").header("Authorization","Bearer "+token).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
    @Test void adminCrudAndDeletedUsersLoseAccess() throws Exception {
        String adminToken=admin();
        var response=mvc.perform(post("/api/usuarios").header("Authorization","Bearer "+adminToken)
            .contentType("application/json").content(body(Map.of("nombre","Ana","email","ana@example.com","password",PASSWORD,"role","USER"))))
            .andExpect(status().isCreated()).andReturn();
        var id=json.readTree(response.getResponse().getContentAsString()).get("id").asText();
        String userToken=login("ana@example.com");
        mvc.perform(get("/api/usuarios?page=0&size=10").header("Authorization","Bearer "+adminToken))
            .andExpect(status().isOk()).andExpect(jsonPath("content.length()").value(2));
        mvc.perform(get("/api/usuarios/"+id).header("Authorization","Bearer "+adminToken)).andExpect(status().isOk());
        mvc.perform(put("/api/usuarios/"+id).header("Authorization","Bearer "+adminToken).contentType("application/json")
            .content(body(Map.of("nombre","Ana Actualizada","email","ana.nueva@example.com"))))
            .andExpect(status().isOk()).andExpect(jsonPath("nombre").value("Ana Actualizada"));
        mvc.perform(delete("/api/usuarios/"+id).header("Authorization","Bearer "+adminToken)).andExpect(status().isNoContent());
        mvc.perform(get("/api/usuarios/"+id).header("Authorization","Bearer "+adminToken)).andExpect(status().isNotFound());
        mvc.perform(get("/api/usuarios/me").header("Authorization","Bearer "+userToken)).andExpect(status().isUnauthorized());
    }
    @Test void duplicatesInvalidInputsAndPrivilegeInjectionAreRejected() throws Exception {
        register("ana@example.com");
        mvc.perform(post("/api/auth/register").contentType("application/json").content(body(Map.of("nombre","Ana","email","ANA@example.com","password",PASSWORD))))
            .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/register").contentType("application/json").content(body(Map.of("nombre","Ana","email","otra@example.com","password",PASSWORD,"role","ADMIN"))))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType("application/json").content(body(Map.of("nombre","","email","mal","password","corta"))))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType("application/json").content(body(Map.of("nombre","Ana","email","otra@example.com","password","🔐".repeat(20)))))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").contentType("application/json").content(body(Map.of("email","ana@example.com","password","incorrecta"))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("detail").value("Credenciales inválidas"));
        mvc.perform(post("/api/auth/login").contentType("application/json").content(body(Map.of("email","nadie@example.com","password","incorrecta"))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("detail").value("Credenciales inválidas"));
        String token=admin();
        mvc.perform(get("/api/usuarios?size=101").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/usuarios/no-es-uuid").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
    }
    private String signedToken(String subject, String issuer, String audience, Instant expires) {
        var claims=JwtClaimsSet.builder().subject(subject).issuer(issuer).audience(List.of(audience))
            .issuedAt(Instant.now().minusSeconds(1800)).expiresAt(expires).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
    }
    @Test void expiredForgedWrongIssuerAndWrongAudienceTokensFail() throws Exception {
        var u=register("ana@example.com");
        String id=u.get("id").asText();
        for(String token:List.of("invalid.jwt.token",
            signedToken(id,"usuarios-api","usuarios-api",Instant.now().minusSeconds(120)),
            signedToken(id,"otro-emisor","usuarios-api",Instant.now().plusSeconds(600)),
            signedToken(id,"usuarios-api","otra-api",Instant.now().plusSeconds(600)),
            signedToken("not-a-uuid","usuarios-api","usuarios-api",Instant.now().plusSeconds(600)))) {
            mvc.perform(get("/api/usuarios/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        }
        String valid=login("ana@example.com");
        String[] pieces=valid.split("\\.");
        String forged=pieces[0]+"."+pieces[1]+"."+(pieces[2].startsWith("A")?"B":"A")+pieces[2].substring(1);
        mvc.perform(get("/api/usuarios/me").header("Authorization","Bearer "+forged)).andExpect(status().isUnauthorized());
    }
    @Test void updateConflictKeepsOriginalProfile() throws Exception {
        String token=admin();
        String id=register("ana@example.com").get("id").asText();
        mvc.perform(put("/api/usuarios/"+id).header("Authorization","Bearer "+token).contentType("application/json")
            .content(body(Map.of("nombre","Cambio","email","admin@example.com"))))
            .andExpect(status().isConflict());
        mvc.perform(get("/api/usuarios/"+id).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("nombre").value("Ana"));
    }
}
