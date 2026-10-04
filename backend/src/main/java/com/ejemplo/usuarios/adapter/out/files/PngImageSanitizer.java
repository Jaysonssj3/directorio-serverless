package com.ejemplo.usuarios.adapter.out.files;
import com.ejemplo.usuarios.application.port.out.ImageSanitizer;
import com.ejemplo.usuarios.domain.BusinessException;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.io.*;
import java.util.Locale;
import static com.ejemplo.usuarios.domain.BusinessException.Kind.INVALID;
public class PngImageSanitizer implements ImageSanitizer {
    public byte[] toSafePng(byte[] archivo) {
        try(var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(archivo))) {
            var readers=ImageIO.getImageReaders(input);
            if(!readers.hasNext()) throw invalid();
            var reader=readers.next();
            try {
                String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                if(!format.equals("png") && !format.equals("jpeg")) throw invalid();
                reader.setInput(input,true,true);
                int w=reader.getWidth(0),h=reader.getHeight(0);
                if(w<1 || h<1 || w>4096 || h>4096 || (long)w*h>4_000_000) throw new BusinessException(INVALID,"Máximo 4096 por lado y 4 millones de píxeles");
                var image=reader.read(0);
                var output=new ByteArrayOutputStream();
                ImageIO.write(image,"png",output);
                if(output.size()>2*1024*1024) throw new BusinessException(INVALID,"Reduce la resolución: PNG procesado mayor de 2 MB");
                return output.toByteArray();
            } finally { reader.dispose(); }
        } catch(IOException | IllegalArgumentException ex) { throw invalid(); }
    }
    private BusinessException invalid() { return new BusinessException(INVALID,"Archivo inválido: selecciona una imagen PNG o JPEG"); }
}
