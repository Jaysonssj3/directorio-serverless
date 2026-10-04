CREATE TABLE usuario_avatar (
    usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido BYTEA NOT NULL,
    actualizado TIMESTAMP WITH TIME ZONE NOT NULL
);
