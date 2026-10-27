import AsyncStorage from '@react-native-async-storage/async-storage';

class RecordStorageError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RecordStorageError';
    this.code = code;
  }
}

function parseRecordList(value) {
  if (value === null) return [];
  let records;
  try {
    records = JSON.parse(value);
  } catch (_) {
    throw new RecordStorageError('STORAGE_INVALID_JSON');
  }
  if (!Array.isArray(records)) {
    throw new RecordStorageError('STORAGE_INVALID_ROOT');
  }
  return records;
}

function createStorage(key) {
  let cache = null;

  async function invalidateCache() {
    let stored;
    try {
      stored = await AsyncStorage.getItem(key);
    } catch (_) {
      throw new RecordStorageError('STORAGE_READ_FAILED');
    }
    // Publish only a trustworthy read; failed reads never become empty data.
    cache = parseRecordList(stored);
  }

  async function get(force = false) {
    if (cache === null || force) {
      await invalidateCache();
    }

    return cache;
  }

  async function set(data) {
    let serialized;
    try {
      serialized = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (_) {
      throw new RecordStorageError('STORAGE_SERIALIZE_FAILED');
    }
    parseRecordList(serialized);
    try {
      await AsyncStorage.setItem(key, serialized);
    } catch (_) {
      throw new RecordStorageError('STORAGE_WRITE_FAILED');
    }
    // Repository forces readback before publishing cache or success.
  }

  return {
    get,
    set,
  };
}

export {createStorage, RecordStorageError};
