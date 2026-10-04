package com.ejemplo.usuarios.adapter.out.persistence;
import com.ejemplo.usuarios.application.port.out.AvatarRepository;
import com.ejemplo.usuarios.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.util.*;
@Repository
public class JdbcAvatarRepository implements AvatarRepository {
    private final JdbcTemplate jdbc;
    public JdbcAvatarRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Optional<Avatar> find(UUID id) {
        return jdbc.query("SELECT usuario_id,contenido,actualizado FROM usuario_avatar WHERE usuario_id=?",
            (rs,n)->new Avatar(rs.getObject(1,UUID.class),rs.getBytes(2),rs.getTimestamp(3).toInstant()),id).stream().findFirst();
    }
    @Transactional public void save(Avatar a) {
        // Bloquea al propietario para serializar dos subidas simultáneas y evitar carreras con DELETE.
        if(jdbc.queryForList("SELECT id FROM usuarios WHERE id=? FOR UPDATE",a.usuarioId()).isEmpty())
            throw new BusinessException(BusinessException.Kind.NOT_FOUND,"Usuario inexistente");
        int count=jdbc.update("UPDATE usuario_avatar SET contenido=?,actualizado=? WHERE usuario_id=?",a.contenido(),Timestamp.from(a.actualizado()),a.usuarioId());
        if(count==0) jdbc.update("INSERT INTO usuario_avatar(usuario_id,contenido,actualizado) VALUES (?,?,?)",a.usuarioId(),a.contenido(),Timestamp.from(a.actualizado()));
    }
}
