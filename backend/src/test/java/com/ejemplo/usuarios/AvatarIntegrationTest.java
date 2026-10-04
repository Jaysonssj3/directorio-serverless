package com.ejemplo.usuarios;
import com.ejemplo.usuarios.application.port.in.UsuariosUseCase;
import com.ejemplo.usuarios.application.port.out.TokenIssuer;
import com.ejemplo.usuarios.domain.Role;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc
class AvatarIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UsuariosUseCase usuarios;
    @Autowired TokenIssuer tokens;
    @Autowired JdbcTemplate jdbc;
    @BeforeEach void reset() { jdbc.update("DELETE FROM usuarios"); }
    private String token(Role role,String email) {
        var u=usuarios.create("Test",email,"UnaClaveLarga123!",role);
        return tokens.issue(u).accessToken();
    }
    private byte[] png() throws Exception {
        var out=new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB),"png",out);
        return out.toByteArray();
    }
    @Test void userCanUploadReadAndReplaceOwnImage() throws Exception {
        String token=token(Role.USER,"photo@example.com");
        mvc.perform(get("/api/usuarios/me/avatar").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        for(int i=0;i<2;i++) mvc.perform(multipart("/api/usuarios/me/avatar").file(new MockMultipartFile("archivo","../../fake.png","image/png",png())).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("contentType").value("image/png"));
        var bytes=mvc.perform(get("/api/usuarios/me/avatar").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
            .andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsByteArray();
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(bytes)).getWidth()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario_avatar",Integer.class)).isEqualTo(1);
    }
    @Test void deniesAnonymousAndOtherUsersButAllowsAdminAndCascadeDelete() throws Exception {
        String owner=token(Role.USER,"owner@example.com");
        UUID id=jdbc.queryForObject("SELECT id FROM usuarios WHERE email='owner@example.com'",UUID.class);
        var file=new MockMultipartFile("archivo","x.png","image/png",png());
        mvc.perform(multipart("/api/usuarios/me/avatar").file(file)).andExpect(status().isUnauthorized());
        String other=token(Role.USER,"other@example.com");
        mvc.perform(multipart("/api/usuarios/"+id+"/avatar").file(file).header("Authorization","Bearer "+other)).andExpect(status().isForbidden());
        mvc.perform(get("/api/usuarios/"+id+"/avatar").header("Authorization","Bearer "+other)).andExpect(status().isForbidden());
        String admin=token(Role.ADMIN,"admin-photo@example.com");
        mvc.perform(multipart("/api/usuarios/"+id+"/avatar").file(file).header("Authorization","Bearer "+admin)).andExpect(status().isOk());
        mvc.perform(get("/api/usuarios/me/avatar").header("Authorization","Bearer "+owner)).andExpect(status().isOk());
        mvc.perform(delete("/api/usuarios/"+id).header("Authorization","Bearer "+admin)).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario_avatar",Integer.class)).isZero();
    }
    @Test void validatesContentSizeAndMissingPart() throws Exception {
        String token=token(Role.USER,"invalid@example.com");
        mvc.perform(multipart("/api/usuarios/me/avatar").file(new MockMultipartFile("archivo","x.png","image/png","not an image".getBytes())).header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/usuarios/me/avatar").file(new MockMultipartFile("archivo","x.png","image/png",new byte[2*1024*1024+1])).header("Authorization","Bearer "+token)).andExpect(status().isPayloadTooLarge());
        mvc.perform(multipart("/api/usuarios/me/avatar").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario_avatar",Integer.class)).isZero();
    }
}
