import {createStorage, RecordStorageError} from '../../Utils/Storage';
import {
  appendRecord,
  removeRecord,
  replaceRecord,
} from '../../features/records/recordModel';
import {
  createImportPlan,
  validateLibrary,
} from '../../features/record-library/archive';
import {
  cloneJsonValue,
  jsonValuesEqual,
} from '../../features/record-library/jsonValue';

class RecordRepositoryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RecordRepositoryError';
    this.code = code;
  }
}

function isolated(value) {
  try {
    return cloneJsonValue(value);
  } catch (_) {
    throw new RecordRepositoryError('RECORD_INVALID_DATA');
  }
}

let repositorySequence = 0;

function createRecordRepository(storage = createStorage('recordList')) {
  const repositoryId = ++repositorySequence;
  let records = [];
  let status = 'loading';
  let error = null;
  let revision = 0;
  let queue = Promise.resolve();
  let nextReceipt = 0;
  const previews = new Map();
  const listeners = new Set();

  const getAll = () => isolated(records);
  const getState = () => ({status, error, revision});
  function publish() {
    listeners.forEach((listener) => {
      try {
        listener(getState());
      } catch (_) {
        // A view subscriber cannot change whether storage committed.
      }
    });
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function enqueue(operation) {
    const result = queue.then(operation);
    // Keep a rejected operation from poisoning the queue. Its caller still
    // receives the original rejection; the internal tail is always handled.
    queue = result.catch(() => undefined);
    return result;
  }
  function requireReady() {
    if (status !== 'ready') {
      throw new RecordRepositoryError('STORAGE_NOT_READY');
    }
  }
  function assertRevision(expectedRevision) {
    if (expectedRevision !== revision) {
      throw new RecordRepositoryError('RECORD_STALE');
    }
  }

  function load() {
    return enqueue(async () => {
      status = 'loading';
      error = null;
      previews.clear();
      publish();
      try {
        const loaded = await storage.get(true);
        if (!Array.isArray(loaded)) {
          throw new RecordStorageError('STORAGE_INVALID_ROOT');
        }
        const trusted = isolated(loaded);
        records = trusted;
        revision += 1;
        status = 'ready';
        publish();
        return getAll();
      } catch (failure) {
        status = 'failed';
        error = failure instanceof RecordStorageError
          ? failure.code
          : 'STORAGE_LOAD_FAILED';
        publish();
        throw new RecordRepositoryError(error);
      }
    });
  }

  async function persist(nextRecords) {
    requireReady();
    if (!Array.isArray(nextRecords)) {
      throw new RecordRepositoryError('RECORD_INVALID_DATA');
    }
    const candidate = isolated(nextRecords);
    try {
      await storage.set(isolated(candidate));
      const stored = await storage.get(true);
      if (!Array.isArray(stored) || !jsonValuesEqual(stored, candidate)) {
        throw new RecordRepositoryError('STORAGE_VERIFICATION_FAILED');
      }
    } catch (_) {
      // Native failures may already have changed disk. Retain trusted memory,
      // block writes and require strict reload; do not pretend to roll back.
      status = 'indeterminate';
      error = 'STORAGE_WRITE_UNCERTAIN';
      publish();
      throw new RecordRepositoryError(error);
    }
    records = candidate;
    revision += 1;
    error = null;
    publish();
    return getAll();
  }

  async function save(nextRecords, options = {}) {
    const candidate = isolated(nextRecords);
    const expectedRevision = options.expectedRevision ?? revision;
    return enqueue(() => {
      requireReady();
      assertRevision(expectedRevision);
      return persist(candidate);
    });
  }
  async function append(record) {
    const candidate = isolated(record);
    return enqueue(() => {
      requireReady();
      return persist(appendRecord(records, candidate));
    });
  }
  function assertEntry(idx, options, calledRevision) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= records.length) {
      throw new RecordRepositoryError('RECORD_STALE');
    }
    assertRevision(options.expectedRevision ?? calledRevision);
    if (Object.prototype.hasOwnProperty.call(options, 'expectedRecord')) {
      if (!jsonValuesEqual(records[idx], options.expectedRecord)) {
        throw new RecordRepositoryError('RECORD_STALE');
      }
    }
  }
  async function updateEntry(idx, record, options, withSnapshot) {
    const candidate = isolated(record);
    const expected = isolated(options);
    const calledRevision = revision;
    return enqueue(async () => {
      requireReady();
      assertEntry(idx, expected, calledRevision);
      const verifiedRecords = await persist(replaceRecord(records, idx, candidate));
      // Capture the revision inside this queued operation. Reading it later
      // could pair an old occurrence with a subsequent mutation's revision.
      return withSnapshot ? {records: verifiedRecords, revision} : verifiedRecords;
    });
  }
  function update(idx, record, options = {}) {
    return updateEntry(idx, record, options, false);
  }
  function updateWithSnapshot(idx, record, options = {}) {
    return updateEntry(idx, record, options, true);
  }
  async function remove(idx, options = {}) {
    const expected = isolated(options);
    const calledRevision = revision;
    return enqueue(() => {
      requireReady();
      assertEntry(idx, expected, calledRevision);
      return persist(removeRecord(records, idx));
    });
  }

  function getSnapshot() {
    return enqueue(() => {
      requireReady();
      return {records: validateLibrary(records), revision};
    });
  }
  async function previewImport(incoming) {
    const imported = isolated(incoming);
    return enqueue(() => {
      requireReady();
      const plan = createImportPlan(records, imported);
      const receipt = `record-import-${repositoryId}-${++nextReceipt}`;
      // UI receives copies; only this private candidate can be committed.
      previews.set(receipt, {plan: isolated(plan), revision});
      if (previews.size > 4) {
        previews.delete(previews.keys().next().value);
      }
      return {...isolated(plan), revision, receipt};
    });
  }
  function discardImport(receipt) {
    previews.delete(receipt);
  }
  function commitImport(receipt) {
    return enqueue(async () => {
      requireReady();
      const preview = previews.get(receipt);
      previews.delete(receipt);
      if (!preview) {
        throw new RecordRepositoryError('IMPORT_PREVIEW_EXPIRED');
      }
      if (preview.revision !== revision) {
        throw new RecordRepositoryError('IMPORT_PREVIEW_STALE');
      }
      if (preview.plan.addedCount > 0) {
        await persist(preview.plan.records);
      }
      return {...isolated(preview.plan), records: getAll(), revision};
    });
  }

  return {
    append, getAll, getSnapshot, getState, load, remove, save, subscribe,
    update, updateWithSnapshot, previewImport, discardImport, commitImport,
  };
}

export {createRecordRepository, RecordRepositoryError};
