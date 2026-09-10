import {createStorage} from '../../Utils/Storage';
import {
  appendRecord,
  removeRecord,
  replaceRecord,
} from '../../features/records/recordModel';

function createRecordRepository(storage = createStorage('recordList')) {
  let records = [];

  async function load() {
    const storedRecords = await storage.get(true);
    records = Array.isArray(storedRecords) ? [...storedRecords] : [];
    return [...records];
  }

  function getAll() {
    return [...records];
  }

  async function save(nextRecords) {
    const snapshot = Array.isArray(nextRecords) ? [...nextRecords] : [];
    await storage.set(snapshot);
    records = snapshot;
    return [...records];
  }

  async function append(record) {
    return save(appendRecord(records, record));
  }

  async function update(idx, record) {
    return save(replaceRecord(records, idx, record));
  }

  async function remove(idx) {
    return save(removeRecord(records, idx));
  }

  return {append, getAll, load, remove, save, update};
}

export {createRecordRepository};
