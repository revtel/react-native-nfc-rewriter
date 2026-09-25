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
import {scanType2Memory} from '../src/services/nfc/type2ScanService';

const version = (size) => [0, 4, 4, 2, 1, 0, size, 3];

beforeEach(() => {
  NfcManager.nfcAHandler.transceive.mockReset();
  runNfcSession.mockReset();
  runNfcSession.mockImplementation(async ({operation}) => ({
    success: true,
    value: await operation(),
  }));
});

function mockTag({size = null, ccSize = 6, ccMagic = 0xe1} = {}) {
  NfcManager.nfcAHandler.transceive.mockImplementation(async (command) => {
    if (command[0] === 0x60) {
      if (size === null) {
        throw new Error('GET_VERSION not supported');
      }
      return version(size);
    }
    const start = command[1];
    const end = command[0] === 0x30 ? start + 3 : command[2];
    const bytes = Array.from(
      {length: (end - start + 1) * 4},
      (_, index) => (start * 4 + index) % 256,
    );
    if (start === 0) {
      bytes.splice(12, 4, ccMagic, 0x10, ccSize, 0);
    }
    return bytes;
  });
}

describe('Type 2 memory scan service', () => {
  it.each([
    [0x0f, 'NTAG213', 45, [0x3a, 44, 44]],
    [0x11, 'NTAG215', 135, [0x3a, 132, 134]],
    [0x13, 'NTAG216', 231, [0x3a, 228, 230]],
  ])('preserves the documented full scan of %s', async (size, model, count, lastCommand) => {
    mockTag({size});
    const onProgress = jest.fn();
    const result = await scanType2Memory({onProgress});

    expect(result).toMatchObject({
      status: 'complete',
      scope: 'full',
      model,
      pageCount: count,
      readPages: count,
    });
    expect(result.pages).toHaveLength(count);
    expect(result.pages[3].bytes).toEqual([0xe1, 0x10, 6, 0]);
    expect(NfcManager.nfcAHandler.transceive.mock.calls[0][0]).toEqual([0x30, 0]);
    expect(NfcManager.nfcAHandler.transceive.mock.calls[1][0]).toEqual([0x60]);
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenLastCalledWith(lastCommand);
    expect(runNfcSession).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenLastCalledWith({model, readPages: count, pageCount: count});
  });

  it('scans a non-NTAG only through its CC-declared data area', async () => {
    mockTag();
    const result = await scanType2Memory();

    expect(result).toMatchObject({
      status: 'complete',
      scope: 'data_area',
      model: 'Type 2',
      pageCount: 16,
      readPages: 16,
    });
    expect(result.pages[15].bytes).toEqual([60, 61, 62, 63]);
    expect(NfcManager.nfcAHandler.transceive.mock.calls.map(([command]) => command)).toEqual([
      [0x30, 0],
      [0x60],
      [0x30, 4],
      [0x30, 8],
      [0x30, 12],
    ]);
  });

  it('uses an overlapping final READ without requesting outside the CC', async () => {
    mockTag({ccSize: 7});
    const result = await scanType2Memory();
    expect(result).toMatchObject({status: 'complete', pageCount: 18, readPages: 18});
    expect(result.pages.map(({address}) => address)).toEqual(
      Array.from({length: 18}, (_, address) => address),
    );
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenLastCalledWith([0x30, 14]);
  });

  it('keeps only four pages when CC is invalid or too large to address', async () => {
    mockTag({ccMagic: 0});
    const invalid = await scanType2Memory();
    expect(invalid).toMatchObject({status: 'limited', scope: 'preview', readPages: 4, limitReason: 'invalid_cc'});
    expect(invalid.pages).toHaveLength(4);
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenCalledTimes(2);

    mockTag({ccSize: 0x7f});
    const tooLarge = await scanType2Memory();
    expect(tooLarge).toMatchObject({status: 'limited', scope: 'preview', readPages: 4, limitReason: 'unaddressable_cc'});
  });

  it('does not identify a tag when the initial standard READ fails', async () => {
    NfcManager.nfcAHandler.transceive.mockRejectedValue(new Error('tag lost'));
    expect(await scanType2Memory()).toEqual({
      status: 'unidentified',
      model: null,
      pages: [],
    });
    expect(NfcManager.nfcAHandler.transceive).toHaveBeenCalledTimes(1);
  });

  it('preserves verified pages after a generic read failure', async () => {
    mockTag();
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) => {
      if (command[0] === 0x30 && command[1] === 8) {
        throw new Error('tag lost');
      }
      return original(command);
    });
    const result = await scanType2Memory();
    expect(result).toMatchObject({
      status: 'partial',
      scope: 'data_area',
      readPages: 8,
      failure: {address: 8, cause: 'unknown'},
    });
    expect(result.pages[7].status).toBe('read');
    expect(result.pages[8].status).toBe('unreadable');
    expect(result.pages[9].status).toBe('not_scanned');
  });

  it('rejects malformed READ responses without mislabeling pages', async () => {
    mockTag();
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) =>
      command[0] === 0x30 && command[1] === 4 ? [0] : original(command),
    );
    const result = await scanType2Memory();
    expect(result).toMatchObject({
      status: 'partial',
      readPages: 4,
      failure: {address: 4, cause: 'invalid_response'},
    });
    expect(result.pages[4].bytes).toBeNull();
  });

  it('rejects inconsistent overlap bytes', async () => {
    mockTag({ccSize: 7});
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) => {
      const bytes = await original(command);
      if (command[0] === 0x30 && command[1] === 14) {
        bytes[0] = 0xff;
      }
      return bytes;
    });
    const result = await scanType2Memory();
    expect(result).toMatchObject({
      status: 'partial',
      readPages: 16,
      failure: {address: 16, cause: 'invalid_response'},
    });
  });

  it('retains NTAG pages verified before a FAST_READ failure', async () => {
    mockTag({size: 0x0f});
    const original = NfcManager.nfcAHandler.transceive.getMockImplementation();
    NfcManager.nfcAHandler.transceive.mockImplementation(async (command) => {
      if (command[0] === 0x3a && command[1] <= 5 && command[2] >= 5) {
        throw new Error('read failed');
      }
      return original(command);
    });
    const result = await scanType2Memory();
    expect(result).toMatchObject({
      status: 'partial',
      scope: 'full',
      readPages: 5,
      failure: {address: 5, cause: 'unknown'},
    });
    expect(result.pages[4].status).toBe('read');
    expect(result.pages[5].status).toBe('unreadable');
  });

  it('never sends write or authentication commands on either path', async () => {
    mockTag({size: 0x0f});
    await scanType2Memory();
    expect(NfcManager.nfcAHandler.transceive.mock.calls.every(
      ([command]) => [0x30, 0x60, 0x3a].includes(command[0]),
    )).toBe(true);
  });
});
