package com.ejemplo.usuarios.adapter.in.lambda;
import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.*;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.*;
import com.ejemplo.usuarios.UsuariosApplication;
import java.io.*;
/** Traduce eventos API Gateway HTTP v2 a los mismos controladores HTTP de Spring. */
public class StreamLambdaHandler implements RequestStreamHandler {
    private static final SpringBootLambdaContainerHandler<HttpApiV2ProxyRequest,AwsProxyResponse> HANDLER;
    static {
        try {
            HANDLER=SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(UsuariosApplication.class,"lambda");
            HANDLER.getContainerConfig().addBinaryContentTypes("image/png","image/jpeg","application/octet-stream","multipart/form-data");
        } catch(ContainerInitializationException e) {
            // No exponer credenciales de conexión en excepciones de inicialización.
            throw new IllegalStateException("No se pudo iniciar Lambda; verifica DATABASE_URL, JWT_SECRET y conectividad");
        }
    }
    @Override public void handleRequest(InputStream input,OutputStream output,Context context) throws IOException {
        HANDLER.proxyStream(input,output,context);
    }
}