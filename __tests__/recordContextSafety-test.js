jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Context, Provider} from '../src/AppContext';
import {createRecordRepository} from '../src/services/records/recordRepository';

async function setup() {
  let disk = [{name: 'trusted', payload: {tech: 'Ndef'}}];
  const storage = {
    get: jest.fn(async () => disk),
    set: jest.fn(async (next) => { disk = next; }),
  };
  const repository = createRecordRepository(storage);
  let app;
  function Consumer() {
    app = React.useContext(Context);
    return null;
  }
  let tree;
  await act(async () => {
    tree = renderer.create(<Provider recordRepository={repository}><Consumer /></Provider>);
  });
  return {storage, repository, tree, app: () => app};
}

test('Context publishes loading/read failure separately from a healthy empty library', async () => {
  const x = await setup();
  expect(x.app().state.storageStatus).toBe('loading');
  x.storage.get.mockRejectedValueOnce(new Error('private storage error'));
  await act(async () => {
    await expect(x.app().actions.initStorage()).rejects.toMatchObject({code: 'STORAGE_LOAD_FAILED'});
  });
  expect(x.app().state).toMatchObject({storageStatus: 'failed', storageError: 'STORAGE_LOAD_FAILED', storageRevision: 0});
  await act(async () => { await x.app().actions.initStorage(); });
  expect(x.app().state).toMatchObject({storageStatus: 'ready', storageError: null, storageRevision: 1});
  expect(x.app().state.storageCache).toEqual([{name: 'trusted', payload: {tech: 'Ndef'}}]);
  await act(async () => x.tree.unmount());
});

test('Context retains trusted records and revision after acknowledged write/readback failure', async () => {
  const x = await setup();
  await act(async () => { await x.app().actions.initStorage(); });
  x.storage.get.mockRejectedValueOnce(new Error('private readback'));
  await act(async () => {
    await expect(x.app().actions.appendRecord({name: 'candidate'})).rejects.toMatchObject({code: 'STORAGE_WRITE_UNCERTAIN'});
  });
  expect(x.app().state).toMatchObject({storageStatus: 'indeterminate', storageError: 'STORAGE_WRITE_UNCERTAIN', storageRevision: 1});
  expect(x.app().state.storageCache).toEqual([{name: 'trusted', payload: {tech: 'Ndef'}}]);
  await act(async () => {
    await expect(x.app().actions.appendRecord({name: 'blocked'})).rejects.toMatchObject({code: 'STORAGE_NOT_READY'});
  });
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  await act(async () => { await x.app().actions.initStorage(); });
  // Recovery reads what is actually stored rather than pretending rollback.
  expect(x.app().state.storageCache).toHaveLength(2);
  expect(x.app().state.storageStatus).toBe('ready');
  await act(async () => x.tree.unmount());
});

test('Context exposes isolated snapshot, preview and one-shot import actions', async () => {
  const x = await setup();
  await act(async () => { await x.app().actions.initStorage(); });
  const snapshot = await x.app().actions.getRecordSnapshot();
  snapshot.records[0].name = 'caller mutation';
  const preview = await x.app().actions.previewRecordImport([{name: 'new'}]);
  await act(async () => { await x.app().actions.commitRecordImport(preview.receipt); });
  expect(x.app().state.storageCache.map((record) => record.name)).toEqual(['trusted', 'new']);
  expect(x.app().state.storageRevision).toBe(2);
  await act(async () => {
    await expect(x.app().actions.commitRecordImport(preview.receipt)).rejects.toMatchObject({code: 'IMPORT_PREVIEW_EXPIRED'});
  });
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  await act(async () => x.tree.unmount());
});

test('ordinary editor snapshot action returns the revision captured by its own update', async () => {
  const x = await setup();
  await act(async () => { await x.app().actions.initStorage(); });
  const before = x.app().state.storageCache[0];
  let verified;
  await act(async () => {
    verified = await x.app().actions.updateRecordSnapshot(0, {name: 'updated'}, {
      expectedRecord: before, expectedRevision: 1,
    });
  });
  expect(verified).toEqual({records: [{name: 'updated'}], revision: 2});
  expect(x.app().state.storageRevision).toBe(2);
  await act(async () => x.tree.unmount());
});
