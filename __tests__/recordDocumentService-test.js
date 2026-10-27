jest.mock('../src/native/NativeRecordDocumentIO', () => ({
  __esModule: true,
  default: {
    readDocument: jest.fn(), createExport: jest.fn(), releaseExport: jest.fn(),
    cancel: jest.fn(), cleanupExports: jest.fn(),
  },
}));
jest.mock('@react-native-documents/picker', () => ({
  types: {json: 'application/json'}, pick: jest.fn(), saveDocuments: jest.fn(),
}));

let io;
let picker;
let service;
beforeEach(() => {
  jest.resetModules();
  io = require('../src/native/NativeRecordDocumentIO').default;
  picker = require('@react-native-documents/picker');
  service = require('../src/services/records/documentService');
  io.cleanupExports.mockResolvedValue(undefined);
  io.readDocument.mockResolvedValue('{"records":[]}');
  io.createExport.mockResolvedValue({token: 'owned', uri: 'file:///private/cache/owned/archive.json'});
  io.releaseExport.mockResolvedValue(undefined);
  picker.pick.mockResolvedValue([{uri: 'content://documents/one', name: 'archive.json', size: null}]);
  picker.saveDocuments.mockResolvedValue([{uri: 'content://saved/one', error: null}]);
});

test('unknown size is read through bounded native IO, not trusted metadata or a copy helper', async () => {
  const result = await service.createDocumentOperation().pickArchive();
  expect(result).toEqual({text: '{"records":[]}', name: 'archive.json'});
  expect(picker.pick).toHaveBeenCalledWith({mode: 'import', allowMultiSelection: false, allowVirtualFiles: false, type: ['application/json']});
  expect(io.readDocument).toHaveBeenCalledWith('content://documents/one', expect.any(String));
});

test('save requires copied, error-free result and releases only its own token', async () => {
  const result = await service.createDocumentOperation().saveArchive('private text', 'records.json');
  expect(result).toEqual({uri: 'content://saved/one'});
  expect(picker.saveDocuments).toHaveBeenCalledWith({sourceUris: ['file:///private/cache/owned/archive.json'], copy: true, mimeType: 'application/json', fileName: 'records.json'});
  expect(io.releaseExport).toHaveBeenCalledWith('owned');
});

test('cleanup failure after provider success keeps saved outcome and retries orphan cleanup next time', async () => {
  io.releaseExport.mockRejectedValueOnce({code: 'DOCUMENT_CLEANUP_FAILED'});
  expect(await service.createDocumentOperation().saveArchive('text')).toEqual({uri: 'content://saved/one', cleanupPending: true});
  await service.createDocumentOperation().pickArchive();
  expect(io.cleanupExports).toHaveBeenCalledTimes(2);
  expect(picker.saveDocuments).toHaveBeenCalledTimes(1);
});

test('cleanup failure cannot hide the original provider failure or cancellation', async () => {
  io.releaseExport.mockRejectedValue({code: 'DOCUMENT_CLEANUP_FAILED'});
  picker.saveDocuments.mockRejectedValueOnce({code: 'private provider message'});
  await expect(service.createDocumentOperation().saveArchive('text')).rejects.toMatchObject({code: 'DOCUMENT_IO_FAILED'});
  picker.saveDocuments.mockRejectedValueOnce({code: 'OPERATION_CANCELED'});
  expect(await service.createDocumentOperation().saveArchive('text')).toBeNull();
});

test.each([
  [], [{uri: 'content://saved/one', error: 'provider failed'}],
  [{uri: 'content://saved/one'}], [{uri: 'https://outside.example/file', error: null}],
  [{uri: 'content://saved/one', error: null}, {uri: 'content://saved/two', error: null}],
].map((result) => [result]))('fulfilled but invalid save result fails without deleting the destination: %p', async (result) => {
  picker.saveDocuments.mockResolvedValue(result);
  await expect(service.createDocumentOperation().saveArchive('text')).rejects.toMatchObject({code: 'DOCUMENT_SAVE_FAILED'});
  expect(io.releaseExport).toHaveBeenCalledWith('owned');
});

test('system picker cancellation is neutral and performs no native read', async () => {
  picker.pick.mockRejectedValue({code: 'OPERATION_CANCELED'});
  expect(await service.createDocumentOperation().pickArchive()).toBeNull();
  expect(io.readDocument).not.toHaveBeenCalled();
});

test('unexpected virtual selection is rejected rather than asking a provider to convert it', async () => {
  picker.pick.mockResolvedValue([{uri: 'content://documents/virtual', isVirtual: true}]);
  await expect(service.createDocumentOperation().pickArchive()).rejects.toMatchObject({code: 'INVALID_DOCUMENT_URI'});
  expect(io.readDocument).not.toHaveBeenCalled();
});

test('late selection after disposal cannot read or return contents', async () => {
  let selected;
  picker.pick.mockImplementation(() => new Promise((resolve) => { selected = resolve; }));
  const operation = service.createDocumentOperation();
  const result = operation.pickArchive();
  await service.cleanupAbandonedExports();
  await Promise.resolve();
  operation.cancel();
  selected([{uri: 'content://documents/one', name: 'late.json'}]);
  expect(await result).toBeNull();
  expect(io.readDocument).not.toHaveBeenCalled();
});

test('late export creation after disposal still cleans the owned source without opening save UI', async () => {
  let created;
  io.createExport.mockImplementation(() => new Promise((resolve) => { created = resolve; }));
  const operation = service.createDocumentOperation();
  const result = operation.saveArchive('private text');
  await service.cleanupAbandonedExports();
  await Promise.resolve();
  operation.cancel();
  created({token: 'owned', uri: 'file:///private/cache/owned/archive.json'});
  expect(await result).toBeNull();
  expect(picker.saveDocuments).not.toHaveBeenCalled();
  expect(io.releaseExport).toHaveBeenCalledWith('owned');
});

test('a provider-confirmed completed save is not relabelled canceled after screen disposal', async () => {
  let saved;
  picker.saveDocuments.mockImplementation(() => new Promise((resolve) => { saved = resolve; }));
  const operation = service.createDocumentOperation();
  const result = operation.saveArchive('text');
  await service.cleanupAbandonedExports();
  await Promise.resolve();
  await Promise.resolve();
  operation.cancel();
  saved([{uri: 'content://saved/one', error: null}]);
  expect(await result).toEqual({uri: 'content://saved/one'});
});

test('native failures are sanitized without passing private URI or provider messages', async () => {
  io.readDocument.mockRejectedValue(new Error('private filename and content'));
  await expect(service.createDocumentOperation().pickArchive()).rejects.toEqual(expect.objectContaining({message: 'DOCUMENT_IO_FAILED', code: 'DOCUMENT_IO_FAILED'}));
});

test('startup and first operation share one cleanup promise', async () => {
  await Promise.all([service.cleanupAbandonedExports(), service.createDocumentOperation().pickArchive()]);
  expect(io.cleanupExports).toHaveBeenCalledTimes(1);
});

test('a disposed operation cannot start a picker and repeated presses do not start a second operation', async () => {
  const stopped = service.createDocumentOperation();
  stopped.cancel();
  expect(await stopped.pickArchive()).toBeNull();
  picker.pick.mockImplementation(() => new Promise(() => {}));
  const operation = service.createDocumentOperation();
  operation.pickArchive();
  await expect(operation.pickArchive()).rejects.toMatchObject({code: 'DOCUMENT_BUSY'});
  operation.cancel();
});

test('loading the service is safe when an older binary has no native module', async () => {
  jest.resetModules();
  jest.doMock('../src/native/NativeRecordDocumentIO', () => { throw new Error('Native module absent'); });
  const oldBinaryService = require('../src/services/records/documentService');
  await expect(oldBinaryService.createDocumentOperation().pickArchive()).rejects.toMatchObject({code: 'DOCUMENT_UNAVAILABLE'});
});
