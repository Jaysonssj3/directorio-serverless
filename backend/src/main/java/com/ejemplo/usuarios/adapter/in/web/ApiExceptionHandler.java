package com.ejemplo.usuarios.adapter.in.web;
import com.ejemplo.usuarios.domain.BusinessException;
import org.slf4j.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log=LoggerFactory.getLogger(ApiExceptionHandler.class);
    @ExceptionHandler(BusinessException.class) ResponseEntity<ProblemDetail> business(BusinessException e) {
        var status=switch(e.kind()) { case NOT_FOUND -> HttpStatus.NOT_FOUND; case CONFLICT -> HttpStatus.CONFLICT; case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED; case INVALID -> HttpStatus.BAD_REQUEST; };
        return ResponseEntity.status(status).body(ProblemDetail.forStatusAndDetail(status,e.getMessage()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException e) {
        var problem=ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"Solicitud inválida");
        problem.setProperty("errors",e.getBindingResult().getFieldErrors().stream().map(f->f.getField()+": "+f.getDefaultMessage()).toList());
        return ResponseEntity.badRequest().body(problem);
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class}) ResponseEntity<ProblemDetail> malformed(Exception e) {
        return ResponseEntity.badRequest().body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"JSON, parámetro o identificador inválido"));
    }
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class) ResponseEntity<ProblemDetail> tooLarge(Exception e) {
        return ResponseEntity.status(413).body(ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE,"Máximo 2 MB por imagen"));
    }
    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,org.springframework.web.bind.MissingServletRequestParameterException.class,org.springframework.web.multipart.MultipartException.class}) ResponseEntity<ProblemDetail> badUpload(Exception e) {
        return ResponseEntity.badRequest().body(ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"Envía multipart/form-data con el campo archivo"));
    }
    @ExceptionHandler(Exception.class) ResponseEntity<ProblemDetail> unexpected(Exception e) {
        // No registrar el cuerpo de la petición, tokens ni valores SQL.
        log.error("Fallo interno: {}",e.getClass().getSimpleName());
        return ResponseEntity.internalServerError().body(ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,"Error interno"));
    }
}
