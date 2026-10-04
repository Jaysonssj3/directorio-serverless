package com.ejemplo.usuarios.application.port.out;
public interface ImageSanitizer {
    byte[] toSafePng(byte[] archivo);
}
