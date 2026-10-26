jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn(),
    cancelTechnologyRequest: jest.fn(),
    getTag: jest.fn(),
    getNdefMessage: jest.fn(),
    getBackgroundTag: jest.fn(),
    ndefHandler: {getNdefMessage: jest.fn()},
    isoDepHandler: {transceive: jest.fn()},
    sendCommandAPDUIOS: jest.fn(),
  },
  NfcTech: {IsoDep: 'IsoDep'},
  NfcError: {UserCancel: class UserCancel extends Error {}},
}));
jest.mock('../src/services/nfc/session', () => ({runNfcSession: jest.fn()}));

import {Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
import {runNfcSession} from '../src/services/nfc/session';
import {scanType4Ndef} from '../src/services/nfc/type4ScanService';
import {createType4Report} from '../src/features/type4-ndef/report';

const cc = [0, 15, 0x20, 0, 240, 0, 52, 4, 6, 0xe1, 4, 1, 0, 0, 255];
const message = [0xd1, 1, 4, 0x54, 2, 0x65, 0x6e, 0x78];
const appSelect = [0, 0xa4, 4, 0, 7, 0xd2, 0x76, 0, 0, 0x85, 1, 1, 0];
let originalPlatform;

function mockTag({
  ccBytes = cc,
  payload = message,
  nlen = payload.length,
  finalNlen = nlen,
  selectData = [],
} = {}) {
  let selected = null;
  let nlenReads = 0;
  const handler = async (command) => {
    if (command[1] === 0xa4) {
      if (command[2] === 0) {
        selected = command[5] * 256 + command[6];
      }
      return [...selectData, 0x90, 0];
    }
    const offset = command[2] * 256 + command[3];
    const length = command[4];
    if (selected === 0xe103) {
      return [...ccBytes.slice(offset, offset + length), 0x90, 0];
    }
    if (offset === 0 && length === 2) {
      const value = nlenReads++ === 0 ? nlen : finalNlen;
      return [Math.floor(value / 256), value % 256, 0x90, 0];
    }
    return [...payload.slice(offset - 2, offset - 2 + length), 0x90, 0];
  };
  NfcManager.isoDepHandler.transceive.mockImplementation(handler);
  NfcManager.sendCommandAPDUIOS.mockImplementation(async (command) => {
    const response = await handler(command);
    return {
      response: response.slice(0, -2),
      sw1: response[response.length - 2],
      sw2: response[response.length - 1],
    };
  });
  return handler;
}

beforeAll(() => {
  originalPlatform = Platform.OS;
});
afterAll(() => {
  Platform.OS = originalPlatform;
});
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  NfcManager.requestTechnology.mockReset().mockResolvedValue('IsoDep');
  NfcManager.cancelTechnologyRequest.mockReset().mockResolvedValue();
  NfcManager.isoDepHandler.transceive.mockReset();
  NfcManager.sendCommandAPDUIOS.mockReset();
  runNfcSession.mockImplementation(async ({technology, operation}) => {
    try {
      await NfcManager.requestTechnology(technology);
      return {success: true, value: await operation()};
    } catch (error) {
      return {success: false, error};
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  });
  mockTag();
});

describe('fresh bounded Type4 APDU flow', () => {
  it.each(['android', 'ios'])(
    'normalizes %s responses, starts fixed SELECT and never probes metadata/NDEF',
    async (platform) => {
      Platform.OS = platform;
      const onProgress = jest.fn();
      const result = await scanType4Ndef({onProgress});
      expect(result).toMatchObject({
        status: 'complete',
        cancelled: false,
        platform,
        metadataAcquisition: {
          method: 'none',
          automaticPlatformSelection: platform === 'ios',
          fullRfTrace: false,
        },
        application: {aid: 'D2760000850101', status: 'selected'},
        cc: {status: 'supported', selectedFile: {fileId: 'E104'}},
        file: {
          id: 'E104',
          maxSize: 256,
          selected: true,
          nlen: 8,
          rawNlen: [0, 8],
          chunks: [{offset: 2, bytes: message}],
        },
        consistency: {
          status: 'equal-length',
          initialNlen: 8,
          finalNlen: 8,
          rawFinalNlen: [0, 8],
          atomicSnapshot: false,
        },
        scope: {
          kind: 'ndef-file',
          plannedBytes: 8,
          readBytes: 8,
          verifiedCcBytes: 15,
          verifiedFileBytes: 25,
          commandsSent: 8,
          maxBytes: 8192,
          maxCcBytes: 1024,
          maxCommands: 1024,
          maxReadBytes: 240,
          limits: [],
        },
        ndef: {status: 'decoded', rawBytes: message},
        failure: null,
      });
      const native =
        platform === 'ios'
          ? NfcManager.sendCommandAPDUIOS
          : NfcManager.isoDepHandler.transceive;
      expect(native.mock.calls.map(([command]) => command)).toEqual([
        appSelect,
        [0, 0xa4, 0, 12, 2, 0xe1, 3],
        [0, 0xb0, 0, 0, 7],
        [0, 0xb0, 0, 7, 8],
        [0, 0xa4, 0, 12, 2, 0xe1, 4],
        [0, 0xb0, 0, 0, 2],
        [0, 0xb0, 0, 2, 8],
        [0, 0xb0, 0, 0, 2],
      ]);
      expect(result.transcript.map(({sequence}) => sequence)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(
        result.transcript.every(
          ({outcome, sw1, sw2}) =>
            outcome === 'success' && sw1 === 0x90 && sw2 === 0,
        ),
      ).toBe(true);
      expect(runNfcSession).toHaveBeenCalledWith(
        expect.objectContaining({
          technology: ['IsoDep'],
          silent: true,
          successMessage: null,
        }),
      );
      for (const helper of [
        NfcManager.getTag,
        NfcManager.getNdefMessage,
        NfcManager.getBackgroundTag,
        NfcManager.ndefHandler.getNdefMessage,
      ]) {
        expect(helper).not.toHaveBeenCalled();
      }
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenLastCalledWith({
        phase: 'recheck-nlen',
        commandsSent: 8,
        bytesRead: 8,
        plannedBytes: 8,
      });
      expect(createType4Report(result).metadataAcquisition).toEqual(
        result.metadataAcquisition,
      );
    },
  );

  it('counts neither SELECT FCI nor final NLEN twice as verified file bytes', async () => {
    mockTag({selectData: Array(256).fill(0x6f)});
    const result = await scanType4Ndef();
    expect(result.status).toBe('complete');
    expect(result.scope.verifiedFileBytes).toBe(25);
    expect(result.transcript[0].data).toHaveLength(256);
    expect(result.transcript[0].responseTruncated).toBe(false);
  });

  it('rechecks initially empty NLEN without any payload read or file reselection', async () => {
    mockTag({payload: []});
    const result = await scanType4Ndef();
    expect(result).toMatchObject({
      status: 'complete',
      consistency: {status: 'equal-length', initialNlen: 0, finalNlen: 0},
      ndef: {status: 'empty', rawBytes: []},
      scope: {commandsSent: 7, verifiedFileBytes: 17, readBytes: 0},
    });
    expect(
      result.transcript.filter(({phase}) => phase === 'read-ndef'),
    ).toEqual([]);
    expect(result.transcript.slice(-2).map(({command}) => command)).toEqual([
      [0, 0xb0, 0, 0, 2],
      [0, 0xb0, 0, 0, 2],
    ]);
  });

  it('reads full multi-chunk CC before selecting the one standard file, never proprietary files', async () => {
    const bytes = [
      0,
      23,
      0x20,
      0,
      15,
      0,
      1,
      5,
      6,
      0xe1,
      5,
      1,
      0,
      0x80,
      255,
      ...cc.slice(7),
    ];
    mockTag({ccBytes: bytes});
    const result = await scanType4Ndef();
    expect(result.status).toBe('complete');
    expect(result.cc.files.map(({fileId}) => fileId)).toEqual(['E105', 'E104']);
    expect(result.transcript.slice(2, 5).map(({command}) => command)).toEqual([
      [0, 0xb0, 0, 0, 7],
      [0, 0xb0, 0, 7, 15],
      [0, 0xb0, 0, 22, 1],
    ]);
    expect(result.transcript[5]).toMatchObject({
      phase: 'select-ndef',
      command: [0, 0xa4, 0, 12, 2, 0xe1, 4],
    });
    expect(
      result.transcript.some(
        ({command}) =>
          command[1] === 0xa4 && command[5] === 0xe1 && command[6] === 5,
      ),
    ).toBe(false);
  });
});

describe('CC profile gates', () => {
  it.each([0x10, 0x21, 0x30])(
    'does not expand unsupported mapping %s',
    async (version) => {
      const bytes = cc.slice();
      bytes[2] = version;
      mockTag({ccBytes: bytes});
      expect(await scanType4Ndef()).toMatchObject({
        status: 'limited',
        cc: {status: 'unsupported', rawBytes: bytes.slice(0, 7)},
        scope: {commandsSent: 3, verifiedCcBytes: 7},
        file: {selected: false},
      });
      expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(3);
    },
  );

  it('stops after capped CCLEN header without selecting NDEF', async () => {
    const bytes = [4, 1, ...cc.slice(2)];
    mockTag({ccBytes: bytes});
    expect(await scanType4Ndef()).toMatchObject({
      status: 'limited',
      cc: {reason: 'cc-byte-limit'},
      scope: {limits: ['cc-byte-limit'], commandsSent: 3},
    });
  });

  it.each([
    [14, 240, 52],
    [15, 14, 52],
    [15, 240, 0],
  ])(
    'retains malformed mandatory header %s/%s/%s',
    async (length, mle, mlc) => {
      const bytes = [0, length, 0x20, 0, mle, 0, mlc];
      mockTag({ccBytes: bytes});
      expect(await scanType4Ndef()).toMatchObject({
        status: 'partial',
        cc: {status: 'malformed', rawBytes: bytes},
        scope: {commandsSent: 3, verifiedCcBytes: 7},
        failure: null,
      });
    },
  );

  it('retains an incomplete CC prefix without selecting NDEF', async () => {
    const original = mockTag();
    NfcManager.isoDepHandler.transceive.mockImplementation(async (command) =>
      command[1] === 0xb0 && command[3] === 7
        ? [4, 6, 0x90, 0]
        : original(command),
    );
    expect(await scanType4Ndef()).toMatchObject({
      status: 'partial',
      cc: {status: 'incomplete', rawBytes: cc.slice(0, 7)},
      scope: {commandsSent: 4, verifiedCcBytes: 7},
      failure: {kind: 'length-mismatch', phase: 'read-cc', offset: 7},
    });
  });

  it.each([1, 0x80, 0xff])(
    'never probes NDEF with access %s',
    async (access) => {
      const bytes = cc.slice();
      bytes[13] = access;
      mockTag({ccBytes: bytes});
      expect(await scanType4Ndef()).toMatchObject({
        status: 'limited',
        cc: {
          status: 'unsupported',
          selectedFile: null,
          files: [{readAccess: access}],
        },
        scope: {commandsSent: 4},
        file: {selected: false},
      });
    },
  );

  it.each([
    [[...cc.slice(7), ...cc.slice(7)], 'multiple-ndef-files'],
    [[6, 8, 0xe1, 4, 0, 0, 1, 0, 0, 255], 'extended-file-control'],
    [[...cc.slice(7), 0, 0], 'unsupported-file-control-type'],
  ])(
    'does not select from unsupported complete CC',
    async (descriptors, reason) => {
      mockTag({
        ccBytes: [0, descriptors.length + 7, ...cc.slice(2, 7), ...descriptors],
      });
      expect(await scanType4Ndef()).toMatchObject({
        status: 'limited',
        cc: {status: 'unsupported', reason, selectedFile: null},
        file: {id: null, selected: false},
      });
      expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(4);
    },
  );
});

describe('NLEN, file and byte limits', () => {
  it('rejects NLEN00FF above file0100 payload capacity without a payload command', async () => {
    mockTag({nlen: 255});
    expect(await scanType4Ndef()).toMatchObject({
      status: 'partial',
      file: {nlen: 255, rawNlen: [0, 255], chunks: []},
      scope: {plannedBytes: null, readBytes: 0, commandsSent: 6},
      failure: {kind: 'invalid-nlen', phase: 'read-nlen'},
      ndef: {status: 'unavailable', reason: 'invalid-nlen'},
    });
  });

  it.each([8192, 8193])(
    'honors 8192-byte cap with minimum MLe15 for NLEN%s',
    async (nlen) => {
      const bytes = cc.slice();
      bytes[4] = 15;
      bytes[6] = 1;
      bytes[11] = 0x7f;
      bytes[12] = 255;
      mockTag({ccBytes: bytes, nlen, payload: Array(nlen).fill(0)});
      const result = await scanType4Ndef();
      expect(result.scope.readBytes).toBe(8192);
      expect(
        result.file.chunks.reduce((sum, {bytes: data}) => sum + data.length, 0),
      ).toBe(8192);
      expect(result.scope.commandsSent).toBeLessThanOrEqual(1024);
      expect(
        result.transcript
          .filter(({phase}) => phase === 'read-ndef')
          .every(
            ({command, offset, requestedLength}) =>
              command[1] === 0xb0 &&
              requestedLength <= 15 &&
              offset + requestedLength <= 8194 &&
              offset <= 0x7fff,
          ),
      ).toBe(true);
      expect(result.status).toBe(nlen === 8192 ? 'complete' : 'limited');
      expect(result.consistency.status).toBe(
        nlen === 8192 ? 'equal-length' : 'not-checked',
      );
      expect(result.ndef.status).toBe(
        nlen === 8192 ? 'malformed' : 'incomplete',
      );
      expect(result.scope.limits).toEqual(
        nlen === 8192 ? [] : ['ndef-byte-limit'],
      );
      expect(
        result.transcript.filter(({phase}) => phase === 'recheck-nlen'),
      ).toHaveLength(nlen === 8192 ? 1 : 0);
    },
  );
});

describe('terminal native/APDU evidence', () => {
  it.each([0x61, 0x6c, 0x69, 0x62])(
    'stops at SW %s with no continuation, retry, or zero-filled unread bytes',
    async (sw1) => {
      const bytes = cc.slice();
      bytes[4] = 15;
      const original = mockTag({ccBytes: bytes, payload: Array(40).fill(7)});
      NfcManager.isoDepHandler.transceive.mockImplementation(async (command) =>
        command[1] === 0xb0 && command[3] === 17
          ? [99, sw1, 0x82]
          : original(command),
      );
      const result = await scanType4Ndef();
      expect(result).toMatchObject({
        status: 'partial',
        scope: {readBytes: 15, commandsSent: 8},
        failure: {
          kind: 'status-word',
          phase: 'read-ndef',
          offset: 17,
          sw1,
          sw2: 0x82,
          responseBytes: [99, sw1, 0x82],
        },
      });
      expect(result.file.chunks).toEqual([
        {offset: 2, bytes: Array(15).fill(7)},
      ]);
      expect(result.ndef.rawBytes).toEqual(Array(15).fill(7));
      expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(8);
    },
  );

  it.each([
    [[1, 0x90, 0], 'length-mismatch'],
    [[...Array(9).fill(1), 0x90, 0], 'length-mismatch'],
    [[1], 'malformed-response'],
  ])('stops short/long/invalid payload response', async (raw, kind) => {
    const original = mockTag();
    NfcManager.isoDepHandler.transceive.mockImplementation(async (command) =>
      command[1] === 0xb0 && command[3] === 2 ? raw : original(command),
    );
    expect(await scanType4Ndef()).toMatchObject({
      status: 'partial',
      failure: {kind, phase: 'read-ndef'},
      file: {chunks: []},
    });
    expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(7);
  });

  it('preserves long native diagnostic length in both transcript and failure without inventing SW', async () => {
    const original = mockTag();
    const diagnostic = 'native cause '.repeat(1000);
    NfcManager.isoDepHandler.transceive.mockImplementation(async (command) => {
      if (command[1] === 0xb0 && command[3] === 2) {
        throw new Error(diagnostic);
      }
      return original(command);
    });
    const result = await scanType4Ndef();
    const evidence = {
      message: diagnostic.slice(0, 4096),
      messageLength: diagnostic.length,
      messageTruncated: true,
      sw1: null,
      sw2: null,
      responseBytes: null,
    };
    expect(result.failure).toMatchObject({
      kind: 'transport-error',
      ...evidence,
    });
    expect(result.transcript[6]).toMatchObject({
      outcome: 'transport-error',
      ...evidence,
    });
  });

  it('rejects oversized SELECT evidence without unbounded arrays or verified memory', async () => {
    NfcManager.isoDepHandler.transceive.mockResolvedValue([
      ...Array(10000).fill(1),
      0x90,
      0,
    ]);
    const result = await scanType4Ndef();
    expect(result).toMatchObject({
      status: 'unavailable',
      application: {status: 'unavailable'},
      scope: {commandsSent: 1, verifiedFileBytes: 0},
      failure: {kind: 'malformed-response'},
    });
    expect(result.transcript[0]).toMatchObject({
      responseLength: 10002,
      responseTruncated: true,
      sw1: 0x90,
      sw2: 0,
    });
    expect(result.transcript[0].data).toHaveLength(256);
    expect(result.failure.responseBytes).toHaveLength(258);
  });

  it('records unavailable iOS SW/length without fabricating success or a second command', async () => {
    Platform.OS = 'ios';
    NfcManager.sendCommandAPDUIOS.mockResolvedValue({response: []});
    const result = await scanType4Ndef();
    expect(result.failure).toMatchObject({
      kind: 'malformed-response',
      sw1: null,
      sw2: null,
    });
    expect(result.transcript[0]).toMatchObject({
      responseLength: null,
      responseTruncated: true,
    });
    expect(NfcManager.sendCommandAPDUIOS).toHaveBeenCalledTimes(1);
  });

  it('keeps acquisition rejection outside APDU transcript', async () => {
    NfcManager.requestTechnology.mockRejectedValue(new Error('cannot acquire'));
    expect(await scanType4Ndef()).toMatchObject({
      status: 'unavailable',
      application: {status: 'not-attempted'},
      transcript: [],
      failure: {
        phase: 'connecting',
        kind: 'transport-error',
        message: 'cannot acquire',
        sw1: null,
        sw2: null,
      },
    });
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });
});

describe('final NLEN consistency boundary', () => {
  it('retains complete bytes but makes interpretation unavailable when final length changes', async () => {
    mockTag({finalNlen: 7});
    expect(await scanType4Ndef()).toMatchObject({
      status: 'partial',
      consistency: {
        status: 'length-changed',
        initialNlen: 8,
        finalNlen: 7,
        rawFinalNlen: [0, 7],
        atomicSnapshot: false,
      },
      ndef: {
        status: 'unavailable',
        rawBytes: message,
        records: [],
        reason: 'length-not-verified',
      },
      failure: {kind: 'length-changed', phase: 'recheck-nlen'},
    });
  });

  it.each([
    [[0x69, 0x82], 'status-word'],
    [[0, 0x90, 0], 'length-mismatch'],
    [[0], 'malformed-response'],
  ])(
    'never calls full payload incomplete/decoded when recheck fails',
    async (response, kind) => {
      const original = mockTag();
      let reads = 0;
      NfcManager.isoDepHandler.transceive.mockImplementation(
        async (command) => {
          if (
            command[1] === 0xb0 &&
            command[3] === 0 &&
            command[4] === 2 &&
            ++reads === 2
          ) {
            return response;
          }
          return original(command);
        },
      );
      const result = await scanType4Ndef();
      expect(result).toMatchObject({
        status: 'partial',
        consistency: {status: 'failed', finalNlen: null},
        ndef: {status: 'unavailable', rawBytes: message, records: []},
        failure: {kind, phase: 'recheck-nlen'},
      });
      expect(result.scope.readBytes).toBe(8);
    },
  );

  it('keeps malformed NDEF independent from complete acquisition and equal length', async () => {
    mockTag({payload: [0xd1, 1, 40, 0x54]});
    expect(await scanType4Ndef()).toMatchObject({
      status: 'complete',
      consistency: {status: 'equal-length'},
      ndef: {status: 'malformed', records: []},
      failure: null,
    });
  });
});

describe('lifecycle cancellation at each native boundary', () => {
  it('does not acquire or emit progress when already cancelled', async () => {
    const onProgress = jest.fn();
    expect(
      await scanType4Ndef({shouldContinue: () => false, onProgress}),
    ).toBeNull();
    expect(runNfcSession).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('rechecks after acquisition and connecting progress', async () => {
    let active = true;
    expect(
      await scanType4Ndef({
        shouldContinue: () => active,
        onProgress: () => {
          active = false;
        },
      }),
    ).toBeNull();
    expect(runNfcSession).not.toHaveBeenCalled();
    active = true;
    NfcManager.requestTechnology.mockImplementation(async () => {
      active = false;
    });
    expect(await scanType4Ndef({shouldContinue: () => active})).toBeNull();
    expect(NfcManager.isoDepHandler.transceive).not.toHaveBeenCalled();
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'stops after pending APDU%s without later RF/callback or invented cancellation failure',
    async (stopAfter) => {
      let active = true;
      let count = 0;
      const original = mockTag();
      NfcManager.isoDepHandler.transceive.mockImplementation(
        async (command) => {
          const response = await original(command);
          if (++count === stopAfter) {
            active = false;
          }
          return response;
        },
      );
      const onProgress = jest.fn(() => {
        expect(active).toBe(true);
      });
      const result = await scanType4Ndef({
        shouldContinue: () => active,
        onProgress,
      });
      if (stopAfter <= 3) {
        expect(result).toBeNull();
      } else {
        expect(result).toMatchObject({
          status: 'partial',
          cancelled: true,
          failure: null,
        });
        expect(result.scope.verifiedCcBytes).toBe(stopAfter === 4 ? 7 : 15);
        expect(result.ndef.status).not.toBe('decoded');
        if (stopAfter === 8) {
          expect(result.ndef.status).toBe('unavailable');
          expect(result.ndef.rawBytes).toEqual(message);
        }
      }
      expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(
        stopAfter,
      );
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
    },
  );

  it('retains CC bytes when a progress callback cancels before CC expansion', async () => {
    let active = true;
    const result = await scanType4Ndef({
      shouldContinue: () => active,
      onProgress: ({phase, commandsSent}) => {
        if (phase === 'read-cc' && commandsSent === 3) {
          active = false;
        }
      },
    });
    expect(result).toMatchObject({
      status: 'partial',
      cancelled: true,
      cc: {rawBytes: cc.slice(0, 7)},
      scope: {commandsSent: 3, verifiedFileBytes: 7},
      failure: null,
    });
  });

  it('does not decode all payload bytes if cancelled before scheduling final NLEN', async () => {
    let active = true;
    const result = await scanType4Ndef({
      shouldContinue: () => active,
      onProgress: ({phase, bytesRead}) => {
        if (phase === 'read-ndef' && bytesRead === 8) {
          active = false;
        }
      },
    });
    expect(result).toMatchObject({
      status: 'partial',
      cancelled: true,
      consistency: {status: 'not-checked'},
      ndef: {status: 'unavailable', rawBytes: message, records: []},
      failure: null,
    });
    expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(7);
  });

  it('retains earlier bytes on native cancellation and counts no SELECT FCI as file bytes', async () => {
    NfcManager.isoDepHandler.transceive.mockRejectedValueOnce(
      new NfcError.UserCancel(),
    );
    expect(await scanType4Ndef()).toBeNull();
    const original = mockTag();
    NfcManager.isoDepHandler.transceive.mockImplementation(async (command) => {
      if (command[1] === 0xb0 && command[3] === 2) {
        throw new NfcError.UserCancel();
      }
      return original(command);
    });
    expect(await scanType4Ndef()).toMatchObject({
      status: 'partial',
      cancelled: true,
      failure: null,
      scope: {verifiedFileBytes: 17, readBytes: 0},
    });
  });
});
