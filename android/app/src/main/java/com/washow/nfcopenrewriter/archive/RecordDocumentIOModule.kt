package com.washow.nfcopenrewriter.archive

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import java.io.Closeable
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.Date
import java.util.Locale
import java.text.SimpleDateFormat
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(name = RecordDocumentIOModule.NAME)
class RecordDocumentIOModule(private val context: ReactApplicationContext) : NativeRecordDocumentIOSpec(context) {
  companion object { const val NAME = "RecordDocumentIO" }
  private class Request {
    val cancelled = AtomicBoolean(false)
    @Volatile var stream: Closeable? = null
    fun cancel() {
      cancelled.set(true)
      try { stream?.close() } catch (_: Exception) { }
    }
  }
  private val workers = Executors.newFixedThreadPool(2)
  private val requests = ConcurrentHashMap<String, Request>()
  private val exports = ConcurrentHashMap<String, File>()
  private val directory = File(context.cacheDir, "record-library-exports")

  override fun getName() = NAME

  private fun request(id: String, promise: Promise, work: (Request) -> Unit) {
    val request = Request()
    if (id.isEmpty() || requests.putIfAbsent(id, request) != null) {
      promise.reject("DOCUMENT_BUSY", "DOCUMENT_BUSY")
      return
    }
    workers.execute {
      try {
        work(request)
      } catch (error: Exception) {
        val code = if (request.cancelled.get()) "CANCELLED"
          else if (error is RecordDocumentCodec.DocumentException) error.code else "DOCUMENT_IO_FAILED"
        promise.reject(code, code)
      } finally {
        try { request.stream?.close() } catch (_: Exception) { }
        requests.remove(id, request)
      }
    }
  }

  override fun readDocument(uri: String, requestId: String, promise: Promise) {
    request(requestId, promise) { task ->
      val source = Uri.parse(uri)
      if (source.scheme != "content" && source.scheme != "file") {
        throw RecordDocumentCodec.DocumentException("INVALID_DOCUMENT_URI")
      }
      if (task.cancelled.get()) throw RecordDocumentCodec.DocumentException("CANCELLED")
      val stream = context.contentResolver.openInputStream(source)
        ?: throw RecordDocumentCodec.DocumentException("DOCUMENT_IO_FAILED")
      task.stream = stream
      stream.use {
        val text = RecordDocumentCodec.read(it) { task.cancelled.get() }
        if (task.cancelled.get()) throw RecordDocumentCodec.DocumentException("CANCELLED")
        promise.resolve(text)
      }
    }
  }

  override fun createExport(text: String, requestId: String, promise: Promise) {
    request(requestId, promise) { task ->
      val bytes = RecordDocumentCodec.encode(text)
      if (task.cancelled.get()) throw RecordDocumentCodec.DocumentException("CANCELLED")
      if (!directory.isDirectory && !directory.mkdirs() && !directory.isDirectory) throw RecordDocumentCodec.DocumentException("DOCUMENT_IO_FAILED")
      val token = UUID.randomUUID().toString()
      val folder = File(directory, token)
      val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
      val target = File(folder, "nfc-open-rewriter-records-$stamp.json")
      exports[token] = target
      try {
        if (!folder.mkdir()) throw RecordDocumentCodec.DocumentException("DOCUMENT_IO_FAILED")
        FileOutputStream(target).use { output ->
          task.stream = output
          var offset = 0
          while (offset < bytes.size) {
            if (task.cancelled.get()) throw RecordDocumentCodec.DocumentException("CANCELLED")
            val length = minOf(8192, bytes.size - offset)
            output.write(bytes, offset, length)
            offset += length
          }
          output.fd.sync()
        }
        if (task.cancelled.get()) throw RecordDocumentCodec.DocumentException("CANCELLED")
        promise.resolve(Arguments.createMap().apply {
          putString("token", token)
          putString("uri", Uri.fromFile(target).toString())
        })
      } catch (error: Exception) {
        exports.remove(token)
        target.delete()
        folder.delete()
        throw error
      }
    }
  }

  override fun releaseExport(token: String, promise: Promise) {
    workers.execute {
      // Retire the active token first: a failed delete becomes an orphan that
      // cleanupExports can retry, rather than an active file skipped forever.
      val file = exports.remove(token)
      if (file != null && file.exists() && !file.delete() && file.exists()) {
        promise.reject("DOCUMENT_CLEANUP_FAILED", "DOCUMENT_CLEANUP_FAILED")
      } else {
        file?.parentFile?.delete()
        promise.resolve(null)
      }
    }
  }

  override fun cleanupExports(promise: Promise) {
    workers.execute {
      var failed = false
      directory.listFiles()?.forEach { folder ->
        if (folder.isDirectory && folder.name.matches(Regex("[0-9a-f-]{36}")) &&
            exports.values.none { it.parentFile == folder }) {
          folder.listFiles()?.forEach { file ->
            if (file.isFile && file.name.matches(Regex("nfc-open-rewriter-records-[0-9-]+\\.json")) && !file.delete()) failed = true
          }
          if (!folder.delete()) failed = true
        }
      }
      if (failed) promise.reject("DOCUMENT_CLEANUP_FAILED", "DOCUMENT_CLEANUP_FAILED") else promise.resolve(null)
    }
  }

  override fun cancel(requestId: String) { requests[requestId]?.cancel() }

  override fun invalidate() {
    requests.values.forEach { it.cancel() }
    workers.shutdown()
    super.invalidate()
  }
}
