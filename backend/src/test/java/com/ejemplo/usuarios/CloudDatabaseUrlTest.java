package com.ejemplo.usuarios;
import com.ejemplo.usuarios.configuration.CloudDatabaseUrl;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class CloudDatabaseUrlTest {
    @Test void parsesNeonCredentialsWithoutPuttingThemInJdbcUrl() {
        var p=CloudDatabaseUrl.parse("postgresql://name:secret%40with%2Bchars@db.example.com/neondb?sslmode=require&channel_binding=require");
        assertThat(p.get("spring.datasource.username")).isEqualTo("name");
        assertThat(p.get("spring.datasource.password")).isEqualTo("secret@with+chars");
        assertThat((String)p.get("spring.datasource.url")).contains("sslmode=verify-full","channelBinding=require").doesNotContain("secret","name:");
    }
    @Test void rejectsUnencryptedAndInjectedDriverSettingsWithoutLeakingTheUri() {
        for(String query:new String[]{"sslmode=disable","sslmode=prefer","sslfactory=some.EvilFactory"}) {
            assertThatThrownBy(()->CloudDatabaseUrl.parse("postgres://user:private-password@db.example.com/test?"+query))
                .isInstanceOf(IllegalArgumentException.class).hasMessageNotContaining("private-password").hasNoCause();
        }
    }
    @Test void rejectsMissingDatabaseOrCredentials() {
        for(String uri:new String[]{"bad uri","postgres://db.example.com/test","postgres://user:pass@db.example.com/"})
            assertThatThrownBy(()->CloudDatabaseUrl.parse(uri)).isInstanceOf(IllegalArgumentException.class);
    }
}
