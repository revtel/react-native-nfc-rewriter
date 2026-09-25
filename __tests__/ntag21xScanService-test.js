jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {nfcAHandler: {transceive: jest.fn()}},
  NfcTech: {NfcA: 'NfcA'},
}));
jest.mock('../src/services/nfc/session', () => ({
  runNfcSession: jest.fn(),
}));

import NfcManager from 'react-native-nfc-manager';
import {runNfcSession} from '../src/services/nfc/session';
import {scanNtag21x} from '../src/services/nfc/ntag21xScanService';

const version = (size) => [0, 4, 4, 2, 1, 0, size, 3];

beforeEach(() => {
  NfcManager.nfcAHandler.transceive.mockReset();
  runNfcSession.mockReset();
  runNfcSession.mockImplementation(async ({operation}) => ({
    success: true,
    value: await operation(),
  }));
});

function mockReadableTag(size) {
  NfcManager.nfcAHandler.transceive.mockImplementation(async (command) => {
    if (command[0] === 0x60) {
      return version(size);
    }
    const [, start, end] = command;
    return Array.from({length: (end - start + 1) * 4}, (_, index) =>
      (start * 4 + index) % 256,
    );
  });
}

describe('NTAG21x scan service', () => {
  it.each([
    [0x0f, 'NTAG213', 45, [0x3a, 44, 44]],
    [0x11, 'NTAG215', 135, [0x3a, 132, 134]],
    [0x13, 'NTAG216', 231, [0x3a, 228, 230]],
  ])('scans only the documented pages of %s', async (size, model, count, lastCommand) => {
    mockReadableTag(size);
    const onProgress = jest.fn();

    const result = await scanNtag21x({onProgress});

    expect(result).toMatchObject({status: 'complete', model, pageCount: count, readPages: count});
    expect(result.pages).toHaveLength(count);
    expect(result.pages[0]).toEqual({address: 0, status: 'read', bytes: [0, 1, 2, 3]});
    expect(result.pages[count - 1].address).toBe(count - 1);
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenLastCalledWith(lastCommand);
    expect(runNfcSession).toHaveBeenCalledTimes(1);
    expect(runNfcSession.mock.calls[0][0]).toMatchObject({
      technology: ['NfcA'],
      successMessage: null,
    });
    expect(onProgress).toHaveBeenLastCalledWith({model, readPages: count, pageCount: count});
    expect(NfcManager.nfcAHandler.transceive.mock.calls.every(
      ([command]) => [0x60, 0x3a].includes(command[0]),
    )).toBe(true);
  });

  it('does not probe memory when identification is unsupported', async () => {
    NfcManager.nfcAHandler.transceive.mockResolvedValue(version(0x10));
    expect(await scanNtag21x()).toEqual({status: 'unsupported', model: null, pages: []});
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenCalledTimes(1);
  });

  it('reports an identification failure without guessing a model', async () => {
    NfcManager.nfcAHandler.transceive.mockRejectedValue(new Error('tag lost'));
    expect(await scanNtag21x()).toEqual({status: 'unidentified', model: null, pages: []});
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenCalledWith([0x60]);
  });

  it('retains verified pages and marks the rest after an unreadable page', async () => {
    mockReadableTag(0x0f);
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) => {
      if (command[0] === 0x3a && command[1] <= 5 && command[2] >= 5) {
        throw new Error('read failed');
      }
      return original(command);
    });

    const result = await scanNtag21x();

    expect(result).toMatchObject({
      status: 'partial',
      model: 'NTAG213',
      readPages: 5,
      failure: {address: 5, cause: 'unknown'},
    });
    expect(result.pages).toHaveLength(45);
    expect(result.pages[4]).toEqual({address: 4, status: 'read', bytes: [16, 17, 18, 19]});
    expect(result.pages[5]).toEqual({address: 5, status: 'unreadable', bytes: null});
    expect(result.pages[6]).toEqual({address: 6, status: 'not_scanned', bytes: null});
  });

  it('rejects a wrong response length without assigning bytes to a page', async () => {
    mockReadableTag(0x0f);
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) =>
      command[0] === 0x3a && command[1] === 0
        ? [0x00]
        : original(command),
    );
    const result = await scanNtag21x();
    expect(result).toMatchObject({
      status: 'partial',
      readPages: 0,
      failure: {address: 0, cause: 'invalid_response'},
    });
    expect(result.pages[0].status).toBe('unreadable');
  });

  it('recovers a readable group by retrying individual pages', async () => {
    mockReadableTag(0x0f);
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) =>
      command[0] === 0x3a && command[1] === 4 && command[2] === 7
        ? [0x00]
        : original(command),
    );

    const result = await scanNtag21x();
    expect(result.status).toBe('complete');
    expect(result.pages.slice(4, 8).map(({address}) => address)).toEqual([4, 5, 6, 7]);
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenCalledWith([0x3a, 4, 4]);
  });

  it('keeps verified pages when an unexpected session error occurs', async () => {
    mockReadableTag(0x0f);
    runNfcSession.mockImplementation(async ({operation}) => {
      try {
        await operation();
      } catch (_) {
        return {success: false, error: new Error('session failed')};
      }
      throw new Error('Expected the progress callback to abort');
    });
    const result = await scanNtag21x({
      onProgress: ({readPages}) => {
        if (readPages === 4) {
          throw new Error('session failed');
        }
      },
    });
    expect(result).toMatchObject({
      status: 'partial',
      readPages: 4,
      failure: {address: 4, cause: 'session_error'},
    });
    expect(result.pages[4].status).toBe('unreadable');
  });
});
