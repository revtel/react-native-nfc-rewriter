jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn(),
    cancelTechnologyRequest: jest.fn(),
    getTag: jest.fn(),
    nfcVHandler: {transceive: jest.fn()},
    iso15693HandlerIOS: {sendRequest: jest.fn()},
  },
  NfcTech: {NfcV: 'NfcV'},
  NfcError: {UserCancel: class UserCancel extends Error {}},
}));
jest.mock('../src/services/nfc/session', () => ({runNfcSession: jest.fn()}));

import {Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
import {runNfcSession} from '../src/services/nfc/session';
import {
  scanType5Memory,
  readConnectedType5Memory,
  createType5ScanPlan,
} from '../src/services/nfc/type5ScanService';

const wire = [6, 5, 4, 3, 2, 1, 4, 0xe0];
const info = (count = 3, size = 4) => [0, 4, ...wire, count - 1, size - 1];
let originalPlatform;

beforeAll(() => {
  originalPlatform = Platform.OS;
});
afterAll(() => {
  Platform.OS = originalPlatform;
});
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  for (const mock of [
    NfcManager.requestTechnology,
    NfcManager.cancelTechnologyRequest,
    NfcManager.getTag,
    NfcManager.nfcVHandler.transceive,
    NfcManager.iso15693HandlerIOS.sendRequest,
  ]) {
    mock.mockReset();
  }
  NfcManager.requestTechnology.mockResolvedValue('NfcV');
  NfcManager.cancelTechnologyRequest.mockResolvedValue();
  NfcManager.getTag.mockResolvedValue({id: '06050403020104E0'});
  // Model the existing wrapper's acquisition, operation and unconditional release.
  // Tests assert the inspector delegates session ownership with alert suppression.
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
  NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) =>
    frame[1] === 0x2b ? info() : [0, frame[10], 1, 2, 3],
  );
});

describe('Type5 native adapters and evidence', () => {
  it.each(['android', 'ios'])(
    'discloses %s metadata API behavior independently of native NDEF evidence',
    async (platform) => {
      Platform.OS = platform;
      const nativeNdef = [{tnf: 1, type: [84], id: [], payload: [0, 120]}];
      const nativeTag = {
        id: platform === 'ios' ? 'E004010203040506' : '06050403020104E0',
        ndefMessage: nativeNdef,
      };
      NfcManager.getTag.mockResolvedValue(nativeTag);
      const raw = [0, 0xe1, 0x40, 1, 0, 0xfe, 0, 0, 0, 0, 0, 0, 0];
      NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) =>
        frame[1] === 0x2b ? info(1, 12) : raw,
      );
      NfcManager.iso15693HandlerIOS.sendRequest.mockImplementation(
        async ({commandCode}) =>
          commandCode === 0x2b
            ? [0, info(1, 12).slice(1)]
            : [raw[0], raw.slice(1)],
      );
      const result = await scanType5Memory();
      expect(result.metadataRead).toEqual({
        method: 'getTag',
        mayReadNdef: platform === 'ios',
        includedInRawReadBounds: false,
      });
      expect(NfcManager.getTag).toHaveBeenCalledTimes(1);
      expect(result.ndef).toMatchObject({
        status: 'absent',
        records: [],
        rawBytes: null,
      });
      expect(result.blocks).toEqual([{address: 0, bytes: raw.slice(1)}]);
      expect(nativeTag.ndefMessage).toEqual(nativeNdef);
    },
  );

  it('uses one quiet session and exact addressed Android frames in order', async () => {
    const result = await scanType5Memory();
    expect(result).toMatchObject({
      status: 'complete',
      cancelled: false,
      platform: 'android',
      tag: {uidDisplayBE: 'E004010203040506', uidWireLE: wire},
      scope: {
        kind: 'reported-range',
        plannedBlocks: 3,
        readBlocks: 3,
        readBytes: 12,
      },
      failure: null,
    });
    expect(
      NfcManager.nfcVHandler.transceive.mock.calls.map(([frame]) => frame),
    ).toEqual([
      [0x22, 0x2b, ...wire],
      [0x22, 0x20, ...wire, 0],
      [0x22, 0x20, ...wire, 1],
      [0x22, 0x20, ...wire, 2],
    ]);
    expect(runNfcSession).toHaveBeenCalledWith(
      expect.objectContaining({
        technology: ['NfcV'],
        silent: true,
        successMessage: null,
      }),
    );
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it('uses iOS actual [flag,data] tuple and explicitly supplies wire UID', async () => {
    Platform.OS = 'ios';
    NfcManager.getTag.mockResolvedValue({id: 'E004010203040506'});
    NfcManager.iso15693HandlerIOS.sendRequest.mockImplementation(
      async ({commandCode}) =>
        commandCode === 0x2b ? [0, info(1).slice(1)] : [0, [0xe1, 0x40, 1, 0]],
    );
    const result = await scanType5Memory();
    expect(result.status).toBe('complete');
    expect(result.systemInfo.rawResponse).toEqual(info(1));
    expect(
      NfcManager.iso15693HandlerIOS.sendRequest.mock.calls.map(
        ([request]) => request,
      ),
    ).toEqual([
      {flags: 0x22, commandCode: 0x2b, data: wire},
      {flags: 0x22, commandCode: 0x20, data: [...wire, 0]},
    ]);
    expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
  });

  it('rejects malformed iOS bridge tuple instead of accepting missing flags', async () => {
    Platform.OS = 'ios';
    NfcManager.getTag.mockResolvedValue({id: 'E004010203040506'});
    NfcManager.iso15693HandlerIOS.sendRequest.mockResolvedValue([0, 1, 2]);
    expect(await scanType5Memory()).toMatchObject({
      status: 'unidentified',
      systemInfo: {
        status: 'malformed',
        reason: 'Invalid iOS ISO15693 response tuple',
      },
      failure: {
        kind: 'malformed-response',
        message: 'Invalid iOS ISO15693 response tuple',
      },
    });
  });

  it('preserves iOS tag error flags separately from rejected native diagnostics', async () => {
    Platform.OS = 'ios';
    NfcManager.getTag.mockResolvedValue({id: 'E004010203040506'});
    NfcManager.iso15693HandlerIOS.sendRequest
      .mockRejectedValueOnce(new Error('Core NFC native diagnostic'))
      .mockResolvedValueOnce([1, [0x10]]);
    expect(await scanType5Memory()).toMatchObject({
      systemInfo: {status: 'unavailable', reason: 'Core NFC native diagnostic'},
      failure: {
        kind: 'tag-error',
        responseFlags: 1,
        tagErrorCode: 0x10,
        rawResponse: [1, 0x10],
      },
    });
  });

  it.each([null, 'E0040102030405E0', '0104010203040506', 'broken'])(
    'stops unusable UID %s without commands',
    async (id) => {
      NfcManager.getTag.mockResolvedValue({id});
      const result = await scanType5Memory();
      expect(result).toMatchObject({
        status: 'unidentified',
        scope: {kind: 'none'},
        failure: {kind: 'uid-unusable', phase: 'identity'},
      });
      expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
    },
  );

  it.each([4, 0xf4])(
    'identity conflict blocks reads even when optional flags %s are malformed/unsupported',
    async (flags) => {
      NfcManager.nfcVHandler.transceive.mockResolvedValue([
        0,
        flags,
        7,
        ...wire.slice(1),
      ]);
      const result = await scanType5Memory();
      expect(result.failure).toMatchObject({
        kind: 'identity-mismatch',
        phase: 'system-info',
        responseFlags: 0,
      });
      expect(result.systemInfo.uidWireLE[0]).toBe(7);
      expect(result.blocks).toEqual([]);
      expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(1);
    },
  );

  it.each(
    [
      [1, 1],
      [0, 11, ...wire, 0, 0, 0x51],
      [0, 4, ...wire, 2],
      [0, 4, ...wire, 2, 0xe3],
      [0, 0x80, ...wire],
      [0, 4, ...wire, 2, 3, 255],
      [0, 4, 6],
    ].map((raw) => [raw]),
  )('unknown or untrusted geometry reads only block zero', async (raw) => {
    NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) =>
      frame[1] === 0x2b ? raw : [0, 0xe2, 0x40, 0, 1],
    );
    const result = await scanType5Memory();
    expect(result).toMatchObject({
      status: 'limited',
      scope: {
        kind: 'block-zero-preview',
        plannedBlocks: 1,
        blockSize: 4,
        reportedBlocks: null,
        readBytes: 4,
      },
      systemInfo: {geometryTrusted: false},
      cc: {status: 'incomplete', length: 8},
    });
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(2);
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenLastCalledWith([
      0x22,
      0x20,
      ...wire,
      0,
    ]);
  });

  it('keeps optional native failure diagnostic but permits block-zero preview', async () => {
    NfcManager.nfcVHandler.transceive
      .mockRejectedValueOnce(new Error('native diagnostic'))
      .mockResolvedValueOnce([0, 0xe1, 0x40, 1, 0]);
    expect(await scanType5Memory()).toMatchObject({
      status: 'limited',
      systemInfo: {status: 'unavailable', reason: 'native diagnostic'},
      failure: null,
    });
  });

  it.each([[[]], [Array(33).fill(0)]])(
    'rejects unknown-geometry block payload length',
    async (bytes) => {
      NfcManager.nfcVHandler.transceive
        .mockResolvedValueOnce([1, 1])
        .mockResolvedValueOnce([0, ...bytes]);
      expect(await scanType5Memory()).toMatchObject({
        status: 'unidentified',
        blocks: [],
        failure: {kind: 'malformed-response', blockAddress: 0},
      });
    },
  );

  it('retains only the verified prefix and exact tag error evidence', async () => {
    NfcManager.nfcVHandler.transceive
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce([0, 1, 2, 3, 4])
      .mockResolvedValueOnce([1, 0x10]);
    expect(await scanType5Memory()).toMatchObject({
      status: 'partial',
      blocks: [{address: 0, bytes: [1, 2, 3, 4]}],
      scope: {readBlocks: 1, readBytes: 4, plannedBlocks: 3},
      failure: {
        kind: 'tag-error',
        phase: 'read-block',
        blockAddress: 1,
        responseFlags: 1,
        tagErrorCode: 0x10,
        rawResponse: [1, 0x10],
      },
    });
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(3);
  });

  it.each([
    [[0, 1], 'block-size-mismatch'],
    [[0x40, 1, 2, 3, 4], 'malformed-response'],
    [[], 'malformed-response'],
  ])('stops at malformed/short block response', async (raw, kind) => {
    NfcManager.nfcVHandler.transceive
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce([0, 1, 2, 3, 4])
      .mockResolvedValueOnce(raw);
    const result = await scanType5Memory();
    expect(result).toMatchObject({
      status: 'partial',
      failure: {kind, blockAddress: 1},
    });
    expect(result.blocks).toHaveLength(1);
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(3);
  });

  it('does not call a native transport failure protection or invent tag error code', async () => {
    NfcManager.nfcVHandler.transceive
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce([0, 1, 2, 3, 4])
      .mockRejectedValueOnce(new Error('unknown native cause'));
    expect(await scanType5Memory()).toMatchObject({
      status: 'partial',
      failure: {
        kind: 'transport-error',
        tagErrorCode: null,
        responseFlags: null,
        rawResponse: null,
        message: 'unknown native cause',
      },
    });
  });

  it('keeps acquisition errors structured without a memory claim', async () => {
    NfcManager.requestTechnology.mockRejectedValue(
      new Error('acquisition failed'),
    );
    expect(await scanType5Memory()).toMatchObject({
      status: 'unidentified',
      failure: {
        kind: 'transport-error',
        phase: 'identity',
        message: 'acquisition failed',
      },
    });
    expect(NfcManager.getTag).not.toHaveBeenCalled();
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });
});

describe('scan limits', () => {
  it.each([1, 4, 32])(
    'reads 256 blocks of size %s without address wrap or excess bytes',
    async (size) => {
      NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) =>
        frame[1] === 0x2b
          ? info(256, size)
          : [0, ...Array(size).fill(frame[10])],
      );
      const result = await scanType5Memory();
      expect(result).toMatchObject({
        status: 'complete',
        scope: {readBlocks: 256, readBytes: 256 * size},
      });
      expect(NfcManager.nfcVHandler.transceive.mock.calls).toHaveLength(257);
      expect(NfcManager.nfcVHandler.transceive).toHaveBeenLastCalledWith([
        0x22,
        0x20,
        ...wire,
        255,
      ]);
      expect(result.blocks[255].bytes).toEqual(Array(size).fill(255));
    },
  );

  it('caps hypothetical larger trusted geometry and does not call it complete', () => {
    expect(
      createType5ScanPlan({
        geometryTrusted: true,
        blockCount: 512,
        blockSize: 32,
      }),
    ).toMatchObject({
      kind: 'bounded-range',
      plannedBlocks: 256,
      maxBytes: 8192,
      limits: ['standard-address-limit', 'byte-limit'],
    });
    expect(
      createType5ScanPlan({
        geometryTrusted: true,
        blockCount: 100000,
        blockSize: 33,
      }),
    ).toMatchObject({kind: 'block-zero-preview', plannedBlocks: 1});
  });
});

describe('local cancellation at every native boundary', () => {
  it('does not acquire a session or emit progress when already cancelled', async () => {
    const onProgress = jest.fn();
    expect(
      await scanType5Memory({shouldContinue: () => false, onProgress}),
    ).toBeNull();
    expect(runNfcSession).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('rechecks after progress before acquisition', async () => {
    let active = true;
    expect(
      await scanType5Memory({
        shouldContinue: () => active,
        onProgress: () => {
          active = false;
        },
      }),
    ).toBeNull();
    expect(runNfcSession).not.toHaveBeenCalled();
  });

  it.each(['acquisition', 'get-tag', 'system-info', 'block-zero'])(
    'rechecks after awaited %s and sends no subsequent command/callback',
    async (point) => {
      let active = true;
      if (point === 'acquisition') {
        NfcManager.requestTechnology.mockImplementation(async () => {
          active = false;
        });
      } else if (point === 'get-tag') {
        NfcManager.getTag.mockImplementation(async () => {
          active = false;
          return {id: '06050403020104E0'};
        });
      } else {
        NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) => {
          if (frame[1] === 0x2b) {
            if (point === 'system-info') {
              active = false;
            }
            return info();
          }
          active = false;
          return [0, 1, 2, 3, 4];
        });
      }
      const onProgress = jest.fn(() => {
        expect(active).toBe(true);
      });
      expect(
        await scanType5Memory({shouldContinue: () => active, onProgress}),
      ).toBeNull();
      expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(
        point === 'system-info' ? 1 : point === 'block-zero' ? 2 : 0,
      );
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
    },
  );

  it('retains verified prefix when cancelled between blocks without failure or later progress', async () => {
    let active = true;
    const onProgress = jest.fn((progress) => {
      expect(active).toBe(true);
      if (progress.blocksRead === 1) {
        active = false;
      }
    });
    const result = await scanType5Memory({
      shouldContinue: () => active,
      onProgress,
    });
    expect(result).toMatchObject({
      status: 'partial',
      cancelled: true,
      failure: null,
      scope: {readBlocks: 1, readBytes: 4},
    });
    expect(result.blocks).toHaveLength(1);
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(2);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it('treats native UserCancel as cancellation without unknown-geometry fallback', async () => {
    NfcManager.nfcVHandler.transceive.mockRejectedValueOnce(
      new NfcError.UserCancel(),
    );
    expect(await scanType5Memory()).toBeNull();
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(1);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it('retains earlier bytes when a later native request is cancelled', async () => {
    NfcManager.nfcVHandler.transceive
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce([0, 1, 2, 3, 4])
      .mockRejectedValueOnce(new NfcError.UserCancel());
    expect(await scanType5Memory()).toMatchObject({
      status: 'partial',
      cancelled: true,
      failure: null,
      blocks: [{address: 0, bytes: [1, 2, 3, 4]}],
    });
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(3);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });
});

describe('connected Home Type5 bounded reads', () => {
  const tag = Object.freeze({id: '06050403020104E0'});
  it('does not acquire metadata or own another session', async () => {
    NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) =>
      frame[1] === 0x2b ? info(4) : frame[10] === 0
        ? [0, 0xe1, 0x40, 1, 0] : [0, 0xfe, 0, 0, 0]);
    const result = await readConnectedType5Memory(tag);
    expect(result).toMatchObject({status: 'limited', stopReason: 'terminator', ndef: {status: 'absent'}, scope: {readBlocks: 2}});
    expect(runNfcSession).not.toHaveBeenCalled();
    expect(NfcManager.getTag).not.toHaveBeenCalled();
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(3);
  });

  it('unknown geometry permits one block only and retains incomplete evidence', async () => {
    NfcManager.nfcVHandler.transceive.mockResolvedValueOnce([1, 1]).mockResolvedValueOnce([0, 0xe1, 0x40, 8, 0]);
    const result = await readConnectedType5Memory(tag);
    expect(result).toMatchObject({status: 'limited', scope: {kind: 'block-zero-preview', readBlocks: 1}, ndef: {status: 'incomplete'}});
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(2);
  });

  it('stops at non-Type5 CC and an identity mismatch without scanning unrelated memory', async () => {
    NfcManager.nfcVHandler.transceive.mockResolvedValueOnce(info(4)).mockResolvedValueOnce([0, 0, 0, 0, 0]);
    expect(await readConnectedType5Memory(tag)).toMatchObject({stopReason: 'cc-unavailable', cc: {status: 'not-type5'}, scope: {readBlocks: 1}});
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(2);
    NfcManager.nfcVHandler.transceive.mockClear();
    const conflict = info(4);
    conflict[2] += 1;
    NfcManager.nfcVHandler.transceive.mockResolvedValueOnce(conflict);
    expect(await readConnectedType5Memory(tag)).toMatchObject({failure: {kind: 'identity-mismatch'}, blocks: []});
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(1);
  });

  it('retains the prefix on the first block error and sends no later command', async () => {
    NfcManager.nfcVHandler.transceive.mockResolvedValueOnce(info(4)).mockResolvedValueOnce([0, 0xe1, 0x40, 1, 0]).mockRejectedValueOnce(new Error('lost'));
    const result = await readConnectedType5Memory(tag);
    expect(result).toMatchObject({status: 'partial', blocks: [{address: 0, bytes: [0xe1, 0x40, 1, 0]}], failure: {kind: 'transport-error', blockAddress: 1, message: 'lost'}, ndef: {status: 'incomplete'}});
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(3);
  });

  it('unusable UID sends no raw commands, including absent connected tag', async () => {
    expect(await readConnectedType5Memory({id: 'invalid'})).toMatchObject({failure: {kind: 'uid-unusable'}});
    expect(await readConnectedType5Memory(undefined)).toMatchObject({failure: {kind: 'uid-unusable'}});
    expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
    expect(runNfcSession).not.toHaveBeenCalled();
  });
});

test('connected malformed native system-info preserves malformed evidence and block-zero limit', async () => {
  NfcManager.nfcVHandler.transceive.mockResolvedValueOnce({malformed: true}).mockResolvedValueOnce([0, 0xe1, 0x40, 1, 0]);
  const result = await readConnectedType5Memory({id: '06050403020104E0'});
  expect(result).toMatchObject({systemInfo: {status: 'malformed'}, scope: {kind: 'block-zero-preview', readBlocks: 1}, rawResponses: [{command: 0x2b, rawResponse: null}, {command: 0x20, blockAddress: 0}]});
  expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(2);
});
