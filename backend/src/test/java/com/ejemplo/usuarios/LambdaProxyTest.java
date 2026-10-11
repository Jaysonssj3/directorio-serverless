package com.ejemplo.usuarios;
import com.amazonaws.services.lambda.runtime.*;
import com.ejemplo.usuarios.adapter.in.lambda.StreamLambdaHandler;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class LambdaProxyTest {
    private final ObjectMapper json=new ObjectMapper();
    private JsonNode invoke(String method,String path,byte[] body,String type,String token,boolean binary) throws Exception {
        var headers=new HashMap<String,String>();headers.put("host","test.execute-api.us-east-1.amazonaws.com");
        if(type!=null) headers.put("content-type",type);
        if(token!=null) headers.put("authorization","Bearer "+token);
        var event=new HashMap<String,Object>();
        event.put("version","2.0");event.put("routeKey","ANY /api/{proxy+}");event.put("rawPath",path);event.put("rawQueryString","");event.put("headers",headers);
        event.put("requestContext",Map.of("stage","$default","requestId",UUID.randomUUID().toString(),"domainName",headers.get("host"),"apiId","test","http",Map.of("method",method,"path",path,"protocol","HTTP/1.1","sourceIp","127.0.0.1","userAgent","JUnit")));
        event.put("isBase64Encoded",binary);
        if(body!=null)event.put("body",binary?Base64.getEncoder().encodeToString(body):new String(body,StandardCharsets.UTF_8));
        var context=mock(Context.class);when(context.getRemainingTimeInMillis()).thenReturn(30000);when(context.getAwsRequestId()).thenReturn(UUID.randomUUID().toString());when(context.getLogger()).thenReturn(mock(LambdaLogger.class));
        var output=new ByteArrayOutputStream();
        new StreamLambdaHandler().handleRequest(new ByteArrayInputStream(json.writeValueAsBytes(event)),output,context);
        return json.readTree(output.toByteArray());
    }
    private JsonNode call(String method,String path,Object body,String token,int expected) throws Exception {
        var response=invoke(method,path,body==null?null:json.writeValueAsBytes(body),"application/json",token,false);
        assertThat(response.path("statusCode").asInt()).as("%s %s: %s",method,path,response.path("body").asText()).isEqualTo(expected);
        return response.path("body").asText().isBlank()?json.nullNode():json.readTree(response.path("body").asText());
    }
    @Test void apiGatewayV2PreservesJwtCrudAndBinaryMultipart() throws Exception {
        String email="lambda."+UUID.randomUUID()+"@example.com",password="LambdaPassword123!";
        call("GET","/api/usuarios",null,null,401);
        var user=call("POST","/api/auth/register",Map.of("nombre","Lambda test","email",email,"password",password),null,201);
        String id=user.path("id").asText();
        String token=call("POST","/api/auth/login",Map.of("email",email,"password",password),null,200).path("accessToken").asText();
        call("GET","/api/usuarios/me",null,token,200);
        call("GET","/api/usuarios",null,token,403);
        var notification=Map.of("email","demo@example.com","subject","Prueba","message","Hola");
        call("POST","/notifications/send",notification,null,401);
        call("POST","/notifications/send",notification,token,403);
        byte[] png=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=");
        String boundary="LambdaBoundary";
        var bytes=new ByteArrayOutputStream();
        bytes.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"archivo\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));bytes.write(png);bytes.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
        var upload=invoke("POST","/api/usuarios/me/avatar",bytes.toByteArray(),"multipart/form-data; boundary="+boundary,token,true);
        assertThat(upload.path("statusCode").asInt()).as(upload.toString()).isEqualTo(200);
        var image=invoke("GET","/api/usuarios/me/avatar",null,null,token,false);
        assertThat(image.path("statusCode").asInt()).isEqualTo(200);
        assertThat(image.path("isBase64Encoded").asBoolean()).isTrue();
        assertThat(Base64.getDecoder().decode(image.path("body").asText())).startsWith((byte)137,(byte)80,(byte)78,(byte)71);
        // Solo en la base desechable de pruebas: convierte el usuario en ADMIN.
        String url=System.getenv().getOrDefault("SPRING_DATASOURCE_URL","jdbc:h2:mem:usuarios;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        try(var connection=DriverManager.getConnection(url,System.getenv().getOrDefault("SPRING_DATASOURCE_USERNAME","sa"),System.getenv().getOrDefault("SPRING_DATASOURCE_PASSWORD",""));var update=connection.prepareStatement("UPDATE usuarios SET role='ADMIN' WHERE id=?")) {
            update.setObject(1,UUID.fromString(id));update.executeUpdate();
        }
        call("GET","/api/usuarios/"+id,null,token,200);
        call("PUT","/api/usuarios/"+id,Map.of("nombre","Actualizado Lambda","email",email),token,200);
        call("DELETE","/api/usuarios/"+id,null,token,204);
        call("GET","/api/usuarios/me",null,token,401);
    }
}
