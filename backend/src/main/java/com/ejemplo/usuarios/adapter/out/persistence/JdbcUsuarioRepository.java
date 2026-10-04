package com.ejemplo.usuarios.adapter.out.persistence;
import com.ejemplo.usuarios.application.port.out.UsuarioRepository;
import com.ejemplo.usuarios.domain.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.util.*;
import static com.ejemplo.usuarios.domain.BusinessException.Kind.*;

@Repository
public class JdbcUsuarioRepository implements UsuarioRepository {
    private final JdbcTemplate jdbc;
    private final RowMapper<Usuario> mapper=(rs,n)-> new Usuario(rs.getObject("id",UUID.class),rs.getString("nombre"),rs.getString("email"),rs.getString("password_hash"),Role.valueOf(rs.getString("role")),rs.getTimestamp("created_at").toInstant());
    public JdbcUsuarioRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Override public Optional<Usuario> findById(UUID id) { return jdbc.query("SELECT * FROM usuarios WHERE id=?",mapper,id).stream().findFirst(); }
    @Override public Optional<Usuario> findByEmail(String email) { return jdbc.query("SELECT * FROM usuarios WHERE email=?",mapper,email).stream().findFirst(); }
    @Override public List<Usuario> findPage(int page,int size) { return jdbc.query("SELECT * FROM usuarios ORDER BY created_at,id LIMIT ? OFFSET ?",mapper,size,(long)page*size); }
    @Override public Usuario insert(Usuario u) {
        try {
            jdbc.update("INSERT INTO usuarios(id,nombre,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",u.id(),u.nombre(),u.email(),u.passwordHash(),u.role().name(),Timestamp.from(u.createdAt()));
            return u;
        } catch(DuplicateKeyException e) { throw new BusinessException(CONFLICT,"El email ya está registrado"); }
    }
    @Override @Transactional public Usuario updateProfile(UUID id,String nombre,String email) {
        try {
            if(jdbc.update("UPDATE usuarios SET nombre=?,email=? WHERE id=?",nombre,email,id)==0)
                throw new BusinessException(NOT_FOUND,"Usuario no encontrado");
            return findById(id).orElseThrow(() -> new BusinessException(NOT_FOUND,"Usuario no encontrado"));
        } catch(DuplicateKeyException e) { throw new BusinessException(CONFLICT,"El email ya está registrado"); }
    }
    @Override public void delete(UUID id) {
        if(jdbc.update("DELETE FROM usuarios WHERE id=?",id)==0) throw new BusinessException(NOT_FOUND,"Usuario no encontrado");
    }
}
