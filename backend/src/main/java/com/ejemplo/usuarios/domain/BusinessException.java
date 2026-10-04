package com.ejemplo.usuarios.domain;
public class BusinessException extends RuntimeException {
    public enum Kind { NOT_FOUND, CONFLICT, UNAUTHORIZED, INVALID }
    private final Kind kind;
    public BusinessException(Kind kind, String message) { super(message); this.kind = kind; }
    public Kind kind() { return kind; }
}
