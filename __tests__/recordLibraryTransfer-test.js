import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {Context, Provider} from '../src/AppContext';
import {createRecordRepository} from '../src/services/records/recordRepository';
import {
  createArchive,
  parseArchive,
} from '../src/features/record-library/archive';
import {
  useRecordLibraryTransfer,
  transferErrorMessage,
} from '../src/features/record-library/useRecordLibraryTransfer';
import {createDocumentOperation} from '../src/services/records/documentService';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/services/records/documentService', () => ({
  createDocumentOperation: jest.fn(),
}));
const A = {name: 'A', payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'a'}};
const B = {name: 'B', payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'b'}};
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}
let alert;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());
async function setup(initial = [], ready = true) {
  let disk = initial;
  const storage = {
    get: jest.fn(async () => disk),
    set: jest.fn(async (records) => {
      disk = records;
    }),
  };
  const repository = createRecordRepository(storage);
  if (ready) await repository.load();
  const events = {};
  const navigation = {
    addListener: (name, callback) => {
      events[name] = callback;
      return () => {
        delete events[name];
      };
    },
  };
  let transfer;
  let app;
  function Harness() {
    app = React.useContext(Context);
    transfer = useRecordLibraryTransfer(app, navigation);
    return null;
  }
  const doc = {
    pickArchive: jest.fn(),
    saveArchive: jest.fn(),
    cancel: jest.fn(),
  };
  createDocumentOperation.mockReturnValue(doc);
  let tree;
  await act(async () => {
    tree = renderer.create(
      <Provider recordRepository={repository}>
        <Harness />
      </Provider>,
    );
  });
  return {
    tree,
    repository,
    storage,
    doc,
    events,
    transfer: () => transfer,
    app: () => app,
  };
}
async function pick(x, records) {
  x.doc.pickArchive.mockResolvedValueOnce({
    text: createArchive(records),
    name: 'backup.json',
  });
  await act(async () => x.transfer().importRecords());
}
async function chooseExport(x) {
  await act(async () => x.transfer().confirmExport());
  return alert.mock.calls
    .at(-1)[2]
    .find((button) => button.text === 'Choose location').onPress;
}

test('real codec/repository preview preserves unsupported and duplicates, then verified additive commit', async () => {
  const x = await setup([A]);
  await pick(x, [A, A, null, B]);
  expect(x.transfer().preview.plan).toMatchObject({
    incomingCount: 4,
    currentCount: 1,
    addedCount: 3,
    existingCount: 1,
    finalCount: 4,
  });
  expect(x.transfer().preview.summary).toMatchObject({unsupportedCount: 1});
  expect(x.storage.set).not.toHaveBeenCalled();
  await act(async () => x.transfer().confirmImport());
  expect(x.repository.getAll()).toEqual([A, A, null, B]);
  expect(x.transfer().notice).toBe('Added 3 records.');
  await pick(x, [A, A, null, B]);
  expect(x.transfer().preview.plan.addedCount).toBe(0);
  await act(async () => x.transfer().confirmImport());
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  await act(async () => x.tree.unmount());
});

test('stale import replans current data and requires a second explicit confirmation', async () => {
  const x = await setup([A]);
  await pick(x, [A, B]);
  await act(async () => x.app().actions.appendRecord(B));
  await act(async () => x.transfer().confirmImport());
  expect(x.transfer().preview.plan).toMatchObject({
    currentCount: 2,
    addedCount: 0,
    finalCount: 2,
  });
  expect(x.transfer().notice).toContain('Review the updated import counts');
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  await act(async () => x.tree.unmount());
});

test('invalid archive errors are actionable and never expose file contents', async () => {
  const x = await setup();
  x.doc.pickArchive.mockResolvedValueOnce({
    text: 'PRIVATE NOT JSON',
    name: 'file.json',
  });
  await act(async () => x.transfer().importRecords());
  expect(alert).toHaveBeenCalledWith(
    'Could not import records',
    expect.stringContaining('Invalid backup'),
  );
  expect(JSON.stringify(alert.mock.calls)).not.toContain('PRIVATE');
  expect(x.storage.set).not.toHaveBeenCalled();
  expect(transferErrorMessage({code: 'archive-depth-limit'})).toContain(
    '64 levels',
  );
  await act(async () => x.tree.unmount());
});

test('picker cancellation and preview cancellation are neutral and discard receipt', async () => {
  const x = await setup();
  x.doc.pickArchive.mockResolvedValueOnce(null);
  await act(async () => x.transfer().importRecords());
  expect(x.transfer().preview).toBe(null);
  await pick(x, [B]);
  const receipt = x.transfer().preview.plan.receipt;
  await act(async () => x.transfer().cancel());
  await expect(x.repository.commitImport(receipt)).rejects.toMatchObject({
    code: 'IMPORT_PREVIEW_EXPIRED',
  });
  expect(x.storage.set).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
  await act(async () => x.tree.unmount());
});

test('a late preview receipt is discarded after leaving the screen and cannot commit', async () => {
  const x = await setup();
  const delayed = deferred();
  const preview = x.repository.previewImport;
  let receipt;
  x.repository.previewImport = async (incoming) => {
    const result = await preview(incoming);
    receipt = result.receipt;
    await delayed.promise;
    return result;
  };
  x.doc.pickArchive.mockResolvedValueOnce({
    text: createArchive([B]),
    name: 'file.json',
  });
  let pending;
  await act(async () => {
    pending = x.transfer().importRecords();
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => x.events.blur());
  await act(async () => {
    delayed.resolve();
    await pending;
  });
  expect(x.transfer().preview).toBe(null);
  await expect(x.repository.commitImport(receipt)).rejects.toMatchObject({
    code: 'IMPORT_PREVIEW_EXPIRED',
  });
  expect(x.storage.set).not.toHaveBeenCalled();
  await act(async () => x.tree.unmount());
});

test('unmounted export snapshot never invokes a document save', async () => {
  const x = await setup([A]);
  const delayed = deferred();
  x.repository.getSnapshot = () => delayed.promise;
  const choose = await chooseExport(x);
  let pending;
  await act(async () => {
    pending = choose();
  });
  await act(async () => x.tree.unmount());
  await act(async () => {
    delayed.resolve({records: [A], revision: 1});
    await pending;
  });
  expect(x.doc.saveArchive).not.toHaveBeenCalled();
});

test('export confirms privacy, saves a complete coherent snapshot and distinguishes cleanup pending', async () => {
  const x = await setup([A, null, A]);
  x.doc.saveArchive.mockResolvedValueOnce({
    uri: 'content://destination',
    cleanupPending: true,
  });
  const choose = await chooseExport(x);
  expect(alert.mock.calls.at(-1)[1]).toContain('not encrypted');
  await act(async () => choose());
  expect(parseArchive(x.doc.saveArchive.mock.calls[0][0]).records).toEqual([
    A,
    null,
    A,
  ]);
  expect(x.transfer().notice).toBe(
    'Backup saved. Temporary backup data will be cleaned up later.',
  );
  expect(x.storage.set).not.toHaveBeenCalled();
  await act(async () => x.tree.unmount());
});

test('commit cannot be canceled or submitted twice after persistence starts', async () => {
  const x = await setup();
  await pick(x, [B]);
  const delayed = deferred();
  x.storage.set.mockImplementationOnce(async (records) => {
    await delayed.promise;
    return records;
  });
  let pending;
  await act(async () => {
    pending = x.transfer().confirmImport();
    await Promise.resolve();
  });
  await act(async () => {
    x.transfer().cancel();
    await x.transfer().confirmImport();
  });
  expect(x.transfer().phase).toBe('committing');
  expect(x.transfer().preview).not.toBeNull();
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  // Simulate the original storage reaching disk before its completion result.
  x.storage.get.mockResolvedValueOnce([B]);
  await act(async () => {
    delayed.resolve();
    await pending;
  });
  expect(x.repository.getAll()).toEqual([B]);
  expect(x.transfer().notice).toBe('Added 1 records.');
  await act(async () => x.tree.unmount());
});

test('untrusted initial storage blocks picker and export confirmation', async () => {
  const x = await setup([], false);
  await act(async () => {
    x.transfer().confirmExport();
    return x.transfer().importRecords();
  });
  expect(alert).not.toHaveBeenCalled();
  expect(createDocumentOperation).not.toHaveBeenCalled();
  await act(async () => x.tree.unmount());
});

test('navigation cannot discard an already submitted commit before its repository turn', async () => {
  const x = await setup();
  await pick(x, [B]);
  const block = deferred();
  const commitImport = x.repository.commitImport;
  x.repository.commitImport = async (receipt) => {
    await block.promise;
    return commitImport(receipt);
  };
  let commit;
  await act(async () => {
    commit = x.transfer().confirmImport();
    await Promise.resolve();
  });
  await act(async () => x.events.blur());
  await act(async () => {
    block.resolve();
    await commit;
  });
  expect(x.repository.getAll()).toEqual([B]);
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  expect(x.transfer().notice).toBeNull();
  await act(async () => x.tree.unmount());
});

test('a canceled export completing late cannot unlock a newer active commit', async () => {
  const x = await setup([A]);
  const save = deferred();
  x.doc.saveArchive.mockReturnValueOnce(save.promise);
  const choose = await chooseExport(x);
  let exporting;
  await act(async () => {
    exporting = choose();
    await Promise.resolve();
  });
  await act(async () => x.transfer().cancel());
  await pick(x, [B]);
  const write = deferred();
  x.storage.set.mockImplementationOnce(async () => write.promise);
  let committing;
  await act(async () => {
    committing = x.transfer().confirmImport();
    await Promise.resolve();
  });
  await act(async () => {
    save.resolve({uri: 'content://saved'});
    await exporting;
  });
  await act(async () => x.transfer().confirmImport());
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  expect(x.transfer().phase).toBe('committing');
  x.storage.get.mockResolvedValueOnce([A, B]);
  await act(async () => {
    write.resolve();
    await committing;
  });
  expect(x.repository.getAll()).toEqual([A, B]);
  await act(async () => x.tree.unmount());
});

test.each([null, 'DOCUMENT_SAVE_FAILED'])(
  'export result %s never claims a saved file',
  async (failure) => {
    const x = await setup([A]);
    if (failure)
      x.doc.saveArchive.mockRejectedValueOnce(
        Object.assign(new Error('PRIVATE'), {code: failure}),
      );
    else x.doc.saveArchive.mockResolvedValueOnce(null);
    const choose = await chooseExport(x);
    await act(async () => choose());
    expect(x.transfer().notice).toBeNull();
    expect(x.storage.set).not.toHaveBeenCalled();
    if (failure)
      expect(alert.mock.calls.at(-1)).toEqual([
        'Could not export records',
        'The file could not be saved. Please try again.',
      ]);
    expect(JSON.stringify(alert.mock.calls)).not.toContain('PRIVATE');
    await act(async () => x.tree.unmount());
  },
);

test('failed verification never reports import success and blocks further file operations', async () => {
  const x = await setup([A]);
  await pick(x, [B]);
  x.storage.get.mockRejectedValueOnce(new Error('PRIVATE'));
  await act(async () => x.transfer().confirmImport());
  expect(x.repository.getAll()).toEqual([A]);
  expect(x.app().state.storageStatus).toBe('indeterminate');
  expect(x.transfer().notice).toBeNull();
  expect(x.transfer().preview).toBeNull();
  expect(alert.mock.calls.at(-1)).toEqual([
    'Could not import records',
    'Saved records could not be read or saved reliably. Reload them before making changes.',
  ]);
  createDocumentOperation.mockClear();
  await act(async () => x.transfer().importRecords());
  expect(createDocumentOperation).not.toHaveBeenCalled();
  await act(async () => x.tree.unmount());
});

test('a stale replan error is handled without an unhandled rejection', async () => {
  const x = await setup([A]);
  await pick(x, [B]);
  await act(async () => x.app().actions.appendRecord(A));
  x.repository.previewImport = jest.fn().mockRejectedValue(
    Object.assign(new Error('PRIVATE'), {
      code: 'archive-library-bytes-limit',
    }),
  );
  await act(async () => x.transfer().confirmImport());
  expect(x.transfer().phase).toBeNull();
  expect(x.transfer().preview).toBeNull();
  expect(alert.mock.calls.at(-1)).toEqual([
    'Could not import records',
    'The backup exceeds the supported limits: 5 MiB file, 1 MiB library, 10,000 records.',
  ]);
  expect(x.storage.set).toHaveBeenCalledTimes(1);
  await act(async () => x.tree.unmount());
});

test.each(['success', 'failure', 'queued'])(
  'a %s commit finishes its busy presentation after blur and refocus before completion',
  async (outcome) => {
    const x = await setup();
    await pick(x, [B]);
    const completion = deferred();
    if (outcome === 'queued') {
      const commitImport = x.repository.commitImport;
      x.repository.commitImport = async (receipt) => {
        await completion.promise;
        return commitImport(receipt);
      };
    } else {
      x.storage.set.mockImplementationOnce(() => completion.promise);
      if (outcome === 'success') x.storage.get.mockResolvedValueOnce([B]);
    }
    let committing;
    await act(async () => {
      committing = x.transfer().confirmImport();
      await Promise.resolve();
    });
    expect(x.transfer().phase).toBe('committing');
    await act(async () => x.events.blur());
    expect(x.transfer().phase).toBeNull();
    await act(async () => x.events.focus());
    expect(x.transfer().phase).toBe('committing');
    const operationsBefore = createDocumentOperation.mock.calls.length;
    await act(async () => x.transfer().importRecords());
    expect(createDocumentOperation).toHaveBeenCalledTimes(operationsBefore);
    await act(async () => {
      if (outcome === 'failure') completion.reject(new Error('PRIVATE'));
      else completion.resolve();
      await committing;
    });
    expect(x.transfer().phase).toBeNull();
    expect(x.transfer().busy).toBe(false);
    expect(x.transfer().preview).toBeNull();
    expect(x.transfer().notice).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    expect(x.repository.getAll()).toEqual(outcome === 'failure' ? [] : [B]);
    expect(x.app().state.storageStatus).toBe(
      outcome === 'failure' ? 'indeterminate' : 'ready',
    );
    if (outcome !== 'failure') {
      await pick(x, [A]);
      expect(x.transfer().preview.plan.addedCount).toBe(1);
    }
    await act(async () => x.tree.unmount());
  },
);
