CREATE TABLE usuarios (
    id UUID PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ADMIN')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_usuarios_email UNIQUE (email),
    CONSTRAINT ck_usuarios_email_normalized CHECK (email = LOWER(TRIM(email)))
);
CREATE INDEX idx_usuarios_created_id ON usuarios (created_at, id);
