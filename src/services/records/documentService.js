// Keep native loading inside user-triggered operations: older installed binaries
// and JavaScript-only tests can still mount the app and report an unavailable action.
let startupCleanup = null;
let sequence = 0;

function documentError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function nativeIO() {
  try {
    return require('../../native/NativeRecordDocumentIO').default;
  } catch (_) {
    throw documentError('DOCUMENT_UNAVAILABLE');
  }
}

function picker() {
  try {
    return require('@react-native-documents/picker');
  } catch (_) {
    throw documentError('DOCUMENT_UNAVAILABLE');
  }
}

function safeError(error) {
  const allowed = [
    'DOCUMENT_UNAVAILABLE', 'DOCUMENT_BUSY', 'DOCUMENT_IO_FAILED',
    'DOCUMENT_CLEANUP_FAILED', 'INVALID_DOCUMENT_URI', 'ARCHIVE_TOO_LARGE',
    'INVALID_UTF8', 'DOCUMENT_SAVE_FAILED',
  ];
  return documentError(allowed.includes(error?.code) ? error.code : 'DOCUMENT_IO_FAILED');
}

function isCancelled(error) {
  return error?.code === 'CANCELLED' || error?.code === 'OPERATION_CANCELED';
}

function validURI(uri) {
  return typeof uri === 'string' && /^(?:file:\/\/\/|content:\/\/[^/])/i.test(uri);
}

function cleanupAbandonedExports() {
  if (!startupCleanup) {
    startupCleanup = Promise.resolve()
      .then(() => nativeIO().cleanupExports())
      .catch((error) => {
        startupCleanup = null;
        throw safeError(error);
      });
  }
  return startupCleanup;
}

function createDocumentOperation() {
  const requestId = `record-library-${Date.now()}-${++sequence}`;
  let active = true;
  let running = false;

  async function run(operation) {
    if (!active) return null;
    if (running) throw documentError('DOCUMENT_BUSY');
    running = true;
    try {
      await cleanupAbandonedExports();
      if (!active) return null;
      return await operation();
    } catch (error) {
      if (!active || isCancelled(error)) return null;
      throw safeError(error);
    } finally {
      running = false;
    }
  }

  return {
    pickArchive() {
      return run(async () => {
        const files = await picker().pick({
          mode: 'import',
          allowMultiSelection: false,
          allowVirtualFiles: false,
          type: [picker().types.json],
        });
        if (!active) return null;
        if (!Array.isArray(files) || files.length !== 1 || !validURI(files[0]?.uri) || files[0]?.isVirtual === true) {
          throw documentError('INVALID_DOCUMENT_URI');
        }
        const selected = files[0];
        // Size metadata may be null or wrong. The native reader is authoritative.
        const text = await nativeIO().readDocument(selected.uri, requestId);
        if (!active) return null;
        return {text, name: typeof selected.name === 'string' ? selected.name : null};
      });
    },
    saveArchive(text, fileName) {
      return run(async () => {
        let source;
        let saved = null;
        try {
          source = await nativeIO().createExport(text, requestId);
          if (!source || typeof source.token !== 'string' || !validURI(source.uri)) {
            throw documentError('DOCUMENT_IO_FAILED');
          }
          if (!active) return null;
          const results = await picker().saveDocuments({
            sourceUris: [source.uri],
            copy: true,
            mimeType: 'application/json',
            ...(typeof fileName === 'string' ? {fileName} : {}),
          });
          // Provider success is stronger than Promise resolution. In particular,
          // saveDocuments can resolve a result with an error or missing URI.
          if (!Array.isArray(results) || results.length !== 1 ||
              results[0]?.error !== null || !validURI(results[0]?.uri)) {
            throw documentError('DOCUMENT_SAVE_FAILED');
          }
          // A completed provider save remains a save even if the screen departed.
          // The UI generation token decides whether to display its result.
          saved = {uri: results[0].uri};
          return saved;
        } finally {
          if (source?.token) {
            try {
              await nativeIO().releaseExport(source.token);
            } catch (_) {
              // Cleanup is retried separately. Never repeat an established save
              // or hide the original provider/cancellation result with cleanup.
              startupCleanup = null;
              if (saved) saved.cleanupPending = true;
            }
          }
        }
      });
    },
    cancel() {
      active = false;
      try { nativeIO().cancel(requestId); } catch (_) { /* No native work exists. */ }
    },
  };
}

export {createDocumentOperation, cleanupAbandonedExports};
