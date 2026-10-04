package com.ejemplo.usuarios.configuration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.*;
public class CloudDatabaseEnvironment implements EnvironmentPostProcessor,Ordered {
    @Override public int getOrder() { return Ordered.LOWEST_PRECEDENCE; }
    @Override public void postProcessEnvironment(ConfigurableEnvironment env,SpringApplication app) {
        String value=env.getProperty("DATABASE_URL");
        if(value!=null && !value.isBlank()) env.getPropertySources().addFirst(new MapPropertySource("cloudDatabase",CloudDatabaseUrl.parse(value)));
    }
}