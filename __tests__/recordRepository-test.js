jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {createRecordRepository} from '../src/services/records/recordRepository';

describe('record repository', () => {
  function createFakeStorage(initial = []) {
    let data = initial;
    return {
      get: jest.fn(async () => data),
      set: jest.fn(async (next) => {
        data = next;
      }),
    };
  }

  it('loads records without exposing its internal list', async () => {
    const record = {name: 'saved', payload: {tech: 'Ndef'}};
    const repository = createRecordRepository(createFakeStorage([record]));

    const records = await repository.load();
    records.push({name: 'local mutation'});

    expect(repository.getAll()).toEqual([record]);
  });

  it('persists immutable append, update, and remove operations', async () => {
    const first = {name: 'first'};
    const second = {name: 'second'};
    const storage = createFakeStorage([first]);
    const repository = createRecordRepository(storage);
    await repository.load();

    expect(await repository.append(second)).toEqual([first, second]);
    expect(await repository.update(0, {name: 'updated'})).toEqual([
      {name: 'updated'},
      second,
    ]);
    expect(await repository.remove(1)).toEqual([{name: 'updated'}]);
    expect(storage.set).toHaveBeenCalledTimes(3);
    expect(storage.get).toHaveBeenCalledTimes(4);
  });

  it('deeply isolates loaded, returned and queued record values', async () => {
    const source = [{name: 'one', payload: {bytes: [1, 2]}}];
    const storage = createFakeStorage(source);
    const repository = createRecordRepository(storage);
    const loaded = await repository.load();
    source[0].payload.bytes[0] = 99;
    loaded[0].payload.bytes.push(3);
    const record = {name: 'two', payload: {bytes: [4]}};
    const pending = repository.append(record);
    record.payload.bytes[0] = 77;
    await pending;
    const all = repository.getAll();
    all[0].payload.bytes[0] = 88;
    expect(repository.getAll()).toEqual([
      {name: 'one', payload: {bytes: [1, 2]}},
      {name: 'two', payload: {bytes: [4]}},
    ]);
  });

  it('read failure cannot be followed by an empty-list overwrite', async () => {
    const storage = createFakeStorage([{name: 'old'}]);
    storage.get.mockRejectedValueOnce(new Error('private native detail'));
    const repository = createRecordRepository(storage);
    await expect(repository.load()).rejects.toMatchObject({code: 'STORAGE_LOAD_FAILED'});
    await expect(repository.append({name: 'new'})).rejects.toMatchObject({code: 'STORAGE_NOT_READY'});
    expect(repository.getState()).toMatchObject({status: 'failed'});
    expect(storage.set).not.toHaveBeenCalled();
    await repository.load();
    expect(repository.getAll()).toEqual([{name: 'old'}]);
  });

  it('failed reload retains last trusted memory until successful strict recovery', async () => {
    const storage = createFakeStorage([{name: 'trusted'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const revision = repository.getState().revision;
    storage.get.mockResolvedValueOnce({unexpected: 'root'});
    await expect(repository.load()).rejects.toMatchObject({code: 'STORAGE_INVALID_ROOT'});
    expect(repository.getAll()).toEqual([{name: 'trusted'}]);
    expect(repository.getState()).toEqual({status: 'failed', error: 'STORAGE_INVALID_ROOT', revision});
    await expect(repository.save([])).rejects.toMatchObject({code: 'STORAGE_NOT_READY'});
    expect(storage.set).not.toHaveBeenCalled();
    await repository.load();
    expect(repository.getState().status).toBe('ready');
  });

  it('serializes concurrent appends without losing an update', async () => {
    const storage = createFakeStorage([{name: 'first'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    await Promise.all([repository.append({name: 'second'}), repository.append({name: 'third'})]);
    expect(repository.getAll().map((record) => record.name)).toEqual(['first', 'second', 'third']);
    expect(storage.set.mock.calls.map(([records]) => records.map((record) => record.name))).toEqual([
      ['first', 'second'], ['first', 'second', 'third'],
    ]);
  });

  test.each(['append', 'update', 'remove', 'clear'])(
    '%s does not publish success when strict readback rejects', async (operation) => {
      const storage = createFakeStorage([{name: 'trusted'}]);
      const repository = createRecordRepository(storage);
      await repository.load();
      const revision = repository.getState().revision;
      storage.get.mockRejectedValueOnce(new Error('SECRET-readback'));
      const operations = {
        append: () => repository.append({name: 'new'}),
        update: () => repository.update(0, {name: 'changed'}),
        remove: () => repository.remove(0),
        clear: () => repository.save([]),
      };
      await expect(operations[operation]()).rejects.toMatchObject({code: 'STORAGE_WRITE_UNCERTAIN'});
      expect(repository.getState()).toEqual({status: 'indeterminate', error: 'STORAGE_WRITE_UNCERTAIN', revision});
      expect(repository.getAll()).toEqual([{name: 'trusted'}]);
      await expect(repository.append({name: 'blocked'})).rejects.toMatchObject({code: 'STORAGE_NOT_READY'});
      expect(storage.set).toHaveBeenCalledTimes(1);
    },
  );

  test.each(['append', 'update', 'remove', 'clear'])(
    '%s write rejection preserves trusted state without rolling back possibly changed disk', async (operation) => {
      const before = [{name: 'first'}, {name: 'second'}];
      const storage = createFakeStorage(before);
      const repository = createRecordRepository(storage);
      await repository.load();
      const revision = repository.getState().revision;
      const write = storage.set.getMockImplementation();
      storage.set.mockImplementationOnce(async (candidate) => {
        await write(candidate);
        throw new Error('PRIVATE write');
      });
      const operations = {
        append: () => repository.append({name: 'after'}),
        update: () => repository.update(0, {name: 'changed'}),
        remove: () => repository.remove(0),
        clear: () => repository.save([]),
      };
      const actualDisk = {
        append: [...before, {name: 'after'}],
        update: [{name: 'changed'}, before[1]],
        remove: [before[1]],
        clear: [],
      }[operation];
      await expect(operations[operation]()).rejects.toMatchObject({code: 'STORAGE_WRITE_UNCERTAIN'});
      expect(repository.getState()).toEqual({status: 'indeterminate', error: 'STORAGE_WRITE_UNCERTAIN', revision});
      expect(repository.getAll()).toEqual(before);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenCalledWith(actualDisk);
      await expect(repository.append({name: 'blocked'})).rejects.toMatchObject({code: 'STORAGE_NOT_READY'});
      expect(storage.set).toHaveBeenCalledTimes(1);

      await repository.load();
      expect(storage.get).toHaveBeenCalledTimes(2);
      expect(storage.get).toHaveBeenLastCalledWith(true);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(repository.getState()).toEqual({status: 'ready', error: null, revision: revision + 1});
      expect(repository.getAll()).toEqual(actualDisk);
    },
  );

  it('mismatching readback retains memory and blocks further writes', async () => {
    const storage = createFakeStorage([{name: 'before'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    storage.get.mockResolvedValueOnce([{name: 'different'}]);
    await expect(repository.append({name: 'after'})).rejects.toMatchObject({code: 'STORAGE_WRITE_UNCERTAIN'});
    expect(repository.getAll()).toEqual([{name: 'before'}]);
    expect(repository.getState().status).toBe('indeterminate');
  });

  it('protects a stale editor index with its original record', async () => {
    const a = {name: 'A'};
    const b = {name: 'B'};
    const c = {name: 'C'};
    const storage = createFakeStorage([a, b, c]);
    const repository = createRecordRepository(storage);
    await repository.load();
    await repository.remove(0, {expectedRecord: a});
    await expect(repository.update(1, {name: 'changed B'}, {expectedRecord: b})).rejects.toMatchObject({code: 'RECORD_STALE'});
    await expect(repository.remove(1, {expectedRecord: b})).rejects.toMatchObject({code: 'RECORD_STALE'});
    expect(repository.getAll()).toEqual([b, c]);
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('captured revisions distinguish equal record occurrences after an earlier one is removed', async () => {
    const a = {name: 'same', payload: {tech: 'Ndef'}};
    const storage = createFakeStorage([a, a]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const openedRevision = repository.getState().revision;
    await repository.remove(0, {expectedRecord: a, expectedRevision: openedRevision});
    await expect(repository.updateWithSnapshot(0, {name: 'changed'}, {
      expectedRecord: a, expectedRevision: openedRevision,
    })).rejects.toMatchObject({code: 'RECORD_STALE'});
    expect(repository.getAll()).toEqual([a]);
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('update snapshots capture their own revision before a queued equal-occurrence removal', async () => {
    const a = {name: 'same', payload: {tech: 'Ndef'}};
    const repository = createRecordRepository(createFakeStorage([a, a]));
    await repository.load();
    const openedRevision = repository.getState().revision;
    let removal;
    const unsubscribe = repository.subscribe((state) => {
      if (state.revision === openedRevision + 1) {
        removal = repository.remove(0, {expectedRecord: a, expectedRevision: state.revision});
      }
    });
    const updated = await repository.updateWithSnapshot(0, a, {
      expectedRecord: a, expectedRevision: openedRevision,
    });
    unsubscribe();
    await removal;
    expect(updated).toEqual({records: [a, a], revision: openedRevision + 1});
    expect(repository.getState().revision).toBe(openedRevision + 2);
    await expect(repository.updateWithSnapshot(0, {name: 'wrong occurrence'}, {
      expectedRecord: updated.records[0], expectedRevision: updated.revision,
    })).rejects.toMatchObject({code: 'RECORD_STALE'});
    expect(repository.getAll()).toEqual([a]);
  });

  it('same-tick index operations cannot bypass revision checks merely by supplying equal records', async () => {
    const a = {name: 'same'};
    const repository = createRecordRepository(createFakeStorage([a, a]));
    await repository.load();
    const removal = repository.remove(0, {expectedRecord: a});
    const update = repository.update(0, {name: 'wrong occurrence'}, {expectedRecord: a});
    await removal;
    await expect(update).rejects.toMatchObject({code: 'RECORD_STALE'});
    expect(repository.getAll()).toEqual([a]);
  });

  it('a stale whole-list replacement cannot erase a concurrently queued append', async () => {
    const storage = createFakeStorage([{name: 'before'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const append = repository.append({name: 'new'});
    const replacement = repository.save([]);
    await append;
    await expect(replacement).rejects.toMatchObject({code: 'RECORD_STALE'});
    expect(repository.getAll()).toEqual([{name: 'before'}, {name: 'new'}]);
  });

  it('export waits for earlier queued writes and snapshots are isolated', async () => {
    const repository = createRecordRepository(createFakeStorage([]));
    await repository.load();
    const append = repository.append({name: 'new'});
    const exportSnapshot = repository.getSnapshot();
    await append;
    const snapshot = await exportSnapshot;
    expect(snapshot.records).toEqual([{name: 'new'}]);
    snapshot.records[0].name = 'mutated';
    await repository.append({name: 'later'});
    expect(repository.getAll()).toEqual([{name: 'new'}, {name: 'later'}]);
  });

  it('preview candidates are private and each receipt can commit only once', async () => {
    const a = {name: 'A'};
    const b = {name: 'B'};
    const storage = createFakeStorage([a]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const preview = await repository.previewImport([a, b, a]);
    expect(preview).toMatchObject({addedCount: 2, existingCount: 1, finalCount: 3});
    preview.records[1].name = 'caller mutation';
    const result = await repository.commitImport(preview.receipt);
    expect(result.records).toEqual([a, b, a]);
    await expect(repository.commitImport(preview.receipt)).rejects.toMatchObject({code: 'IMPORT_PREVIEW_EXPIRED'});
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('stale previews require a new preview after ordinary edits', async () => {
    const storage = createFakeStorage([{name: 'A'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const preview = await repository.previewImport([{name: 'B'}]);
    await repository.append({name: 'C'});
    await expect(repository.commitImport(preview.receipt)).rejects.toMatchObject({code: 'IMPORT_PREVIEW_STALE'});
    expect(repository.getAll()).toEqual([{name: 'A'}, {name: 'C'}]);
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('a no-new import is consumed without writing or incrementing revision', async () => {
    const storage = createFakeStorage([{name: 'A'}, {name: 'A'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const revision = repository.getState().revision;
    const preview = await repository.previewImport([{name: 'A'}, {name: 'A'}]);
    const result = await repository.commitImport(preview.receipt);
    expect(result).toMatchObject({addedCount: 0, revision});
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('import write/readback failure uses the same uncertain outcome as ordinary saves', async () => {
    const storage = createFakeStorage([{name: 'A'}]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const revision = repository.getState().revision;
    const preview = await repository.previewImport([{name: 'B'}]);
    storage.get.mockResolvedValueOnce([]);
    await expect(repository.commitImport(preview.receipt)).rejects.toMatchObject({code: 'STORAGE_WRITE_UNCERTAIN'});
    expect(repository.getState()).toMatchObject({status: 'indeterminate', revision});
    expect(repository.getAll()).toEqual([{name: 'A'}]);
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('oversized legacy records remain readable but export/import fail without filtering them', async () => {
    const records = [{payload: 'x'.repeat(1024 * 1024)}];
    const storage = createFakeStorage(records);
    const repository = createRecordRepository(storage);
    await repository.load();
    await expect(repository.getSnapshot()).rejects.toHaveProperty('code', 'archive-library-bytes-limit');
    await expect(repository.previewImport([])).rejects.toHaveProperty('code', 'archive-library-bytes-limit');
    expect(repository.getAll()).toEqual(records);
    expect(repository.getState().status).toBe('ready');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('discarded receipts and restarted repositories cannot replay an import', async () => {
    const storage = createFakeStorage([]);
    const repository = createRecordRepository(storage);
    await repository.load();
    const preview = await repository.previewImport([{name: 'new'}]);
    repository.discardImport(preview.receipt);
    await expect(repository.commitImport(preview.receipt)).rejects.toMatchObject({code: 'IMPORT_PREVIEW_EXPIRED'});
    const restarted = createRecordRepository(storage);
    await restarted.load();
    await expect(restarted.commitImport(preview.receipt)).rejects.toMatchObject({code: 'IMPORT_PREVIEW_EXPIRED'});
    expect(storage.set).not.toHaveBeenCalled();
  });
});
