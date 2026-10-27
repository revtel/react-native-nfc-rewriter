package com.washow.nfcopenrewriter.archive;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;

/** Standalone JVM harness: javac the production codec plus this file; no Android/JUnit dependency. */
public final class RecordDocumentCodecHarness {
  private static int checked;
  private static void equal(Object expected, Object actual) {
    if (!expected.equals(actual)) throw new AssertionError("Mismatch");
    checked++;
  }
  private static void fails(String code, InputStream input) throws Exception {
    try { RecordDocumentCodec.read(input, () -> false); throw new AssertionError("Expected failure"); }
    catch (RecordDocumentCodec.DocumentException error) { equal(code, error.code); }
  }
  public static void main(String[] ignored) throws Exception {
    byte[] unicode = "中文 日本語 🏷️ & #".getBytes(StandardCharsets.UTF_8);
    InputStream shortReads = new ByteArrayInputStream(unicode) {
      @Override public synchronized int read(byte[] bytes, int offset, int length) {
        return super.read(bytes, offset, Math.min(length, 2));
      }
    };
    equal(new String(unicode, StandardCharsets.UTF_8), RecordDocumentCodec.read(shortReads, () -> false));
    equal("", RecordDocumentCodec.read(new ByteArrayInputStream(new byte[0]), () -> false));
    byte[] max = new byte[RecordDocumentCodec.MAX_BYTES];
    Arrays.fill(max, (byte)'a');
    equal(RecordDocumentCodec.MAX_BYTES, RecordDocumentCodec.read(new ByteArrayInputStream(max), () -> false).length());
    fails("ARCHIVE_TOO_LARGE", new ByteArrayInputStream(Arrays.copyOf(max, max.length + 1)));
    fails("INVALID_UTF8", new ByteArrayInputStream(new byte[]{(byte)0xc0, (byte)0x80}));
    fails("INVALID_UTF8", new ByteArrayInputStream(new byte[]{(byte)0xe4, (byte)0xb8}));
    fails("INVALID_UTF8", new ByteArrayInputStream(new byte[]{(byte)0xed, (byte)0xa0, (byte)0x80}));
    AtomicInteger polls = new AtomicInteger();
    try {
      RecordDocumentCodec.read(new ByteArrayInputStream(unicode), () -> polls.incrementAndGet() >= 2);
      throw new AssertionError("Expected cancellation");
    } catch (RecordDocumentCodec.DocumentException error) { equal("CANCELLED", error.code); }
    InputStream zeroThenBytes = new ByteArrayInputStream(unicode) {
      private boolean first = true;
      @Override public synchronized int read(byte[] bytes, int offset, int length) {
        if (first) { first = false; return 0; }
        return super.read(bytes, offset, length);
      }
    };
    equal(new String(unicode, StandardCharsets.UTF_8), RecordDocumentCodec.read(zeroThenBytes, () -> false));
    equal(unicode.length, RecordDocumentCodec.encode(new String(unicode, StandardCharsets.UTF_8)).length);
    try { RecordDocumentCodec.encode("\ud800"); throw new AssertionError("Expected encoding failure"); }
    catch (RecordDocumentCodec.DocumentException error) { equal("INVALID_UTF8", error.code); }
    System.out.println("RecordDocumentCodec JVM PASS: " + checked + " checks");
  }
}
