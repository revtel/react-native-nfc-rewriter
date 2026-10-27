package com.washow.nfcopenrewriter.archive;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.function.BooleanSupplier;

/** Bounded, strict UTF-8 IO shared by the native module and JVM regression harness. */
public final class RecordDocumentCodec {
  public static final int MAX_BYTES = 5 * 1024 * 1024;

  public static final class DocumentException extends IOException {
    public final String code;
    DocumentException(String code) { super(code); this.code = code; }
  }

  private static void check(BooleanSupplier cancelled) throws DocumentException {
    if (cancelled.getAsBoolean()) throw new DocumentException("CANCELLED");
  }

  public static String read(InputStream stream, BooleanSupplier cancelled) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    int total = 0;
    while (true) {
      check(cancelled);
      int count = stream.read(buffer, 0, Math.min(buffer.length, MAX_BYTES + 1 - total));
      check(cancelled);
      if (count < 0) break;
      if (count == 0) {
        // Do not spin forever on a provider that returns a zero-length short read.
        int value = stream.read();
        check(cancelled);
        if (value < 0) break;
        output.write(value);
        total++;
      } else {
        output.write(buffer, 0, count);
        total += count;
      }
      if (total > MAX_BYTES) throw new DocumentException("ARCHIVE_TOO_LARGE");
    }
    check(cancelled);
    try {
      return StandardCharsets.UTF_8.newDecoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .decode(ByteBuffer.wrap(output.toByteArray())).toString();
    } catch (CharacterCodingException error) {
      throw new DocumentException("INVALID_UTF8");
    }
  }

  public static byte[] encode(String text) throws DocumentException {
    if (text.length() > MAX_BYTES) throw new DocumentException("ARCHIVE_TOO_LARGE");
    try {
      ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .encode(java.nio.CharBuffer.wrap(text));
      if (encoded.remaining() > MAX_BYTES) throw new DocumentException("ARCHIVE_TOO_LARGE");
      byte[] bytes = new byte[encoded.remaining()];
      encoded.get(bytes);
      return bytes;
    } catch (CharacterCodingException error) {
      throw new DocumentException("INVALID_UTF8");
    }
  }

  private RecordDocumentCodec() {}
}
