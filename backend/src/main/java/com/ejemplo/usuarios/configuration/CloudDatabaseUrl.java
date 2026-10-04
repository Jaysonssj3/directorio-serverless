package com.ejemplo.usuarios.configuration;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** Convierte la URI de Neon en propiedades JDBC, sin incluir credenciales en el JDBC URL. */
public final class CloudDatabaseUrl {
    private CloudDatabaseUrl() {}
    public static Map<String,Object> parse(String value) {
        try {
            URI uri=new URI(value);
            if(!Set.of("postgres","postgresql").contains(uri.getScheme()) || uri.getHost()==null || uri.getFragment()!=null) throw new IllegalArgumentException();
            String raw=uri.getRawUserInfo();
            if(raw==null || !raw.contains(":")) throw new IllegalArgumentException();
            String[] credentials=raw.split(":",2);
            String user=decode(credentials[0]),password=decode(credentials[1]);
            if(user.isBlank() || password.isBlank() || uri.getPath()==null || uri.getPath().length()<2) throw new IllegalArgumentException();
            Map<String,String> params=new LinkedHashMap<>();
            if(uri.getRawQuery()!=null) for(String item:uri.getRawQuery().split("&")) {
                String[] pair=item.split("=",2);
                String key=decode(pair[0]);
                // No permitir parámetros que ejecuten fábricas/clases JDBC arbitrarias.
                if(!Set.of("sslmode","channel_binding","channelBinding").contains(key)) throw new IllegalArgumentException();
                params.put(key,pair.length>1?decode(pair[1]):"");
            }
            String ssl=params.getOrDefault("sslmode","require");
            if(!Set.of("require","verify-full").contains(ssl)) throw new IllegalArgumentException();
            String channel=params.getOrDefault("channel_binding",params.getOrDefault("channelBinding","prefer"));
            if(!Set.of("prefer","require").contains(channel)) throw new IllegalArgumentException();
            String host=uri.getHost();
            if(host.contains(":") && !host.startsWith("[")) host="["+host+"]";
            // Verificar certificado y hostname con las CA de Java, incluso si Neon da sslmode=require.
            String jdbc="jdbc:postgresql://"+host+":"+(uri.getPort()<0?5432:uri.getPort())+uri.getRawPath()
                +"?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding="+channel+"&connectTimeout=10&socketTimeout=20";
            return Map.of("spring.datasource.url",jdbc,"spring.datasource.username",user,"spring.datasource.password",password);
        } catch(Exception e) { throw new IllegalArgumentException("DATABASE_URL inválida: usa una URI PostgreSQL cloud con usuario, contraseña y SSL; no la escribas en logs"); }
    }
    private static String decode(String value) { return URLDecoder.decode(value.replace("+","%2B"),StandardCharsets.UTF_8); }
}