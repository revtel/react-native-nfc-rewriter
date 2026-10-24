import Ndef from 'react-native-nfc-manager/ndef-lib';
import {
  analyzeType4Cc,
  analyzeType4Ndef,
} from '../src/features/type4-ndef/model';
import {createType4Report} from '../src/features/type4-ndef/report';

const standard = [4, 6, 0xe1, 4, 1, 0, 0, 255];
const proprietary = [5, 6, 0xe1, 5, 1, 0, 0x80, 255];
const cc = [0, 15, 0x20, 0, 240, 0, 52, ...standard];
const message = [0xd1, 1, 4, 0x54, 2, 0x65, 0x6e, 0x78];
function withDescriptors(descriptors) {
  const length = descriptors.length + 7;
  return [
    Math.floor(length / 256),
    length % 256,
    ...cc.slice(2, 7),
    ...descriptors,
  ];
}

describe('complete Type4 CC profile', () => {
  it('interprets the exact normal CC and seven-byte prefix without premature selection', () => {
    expect(analyzeType4Cc(cc.slice(0, 7))).toMatchObject({
      status: 'incomplete',
      declaredLength: 15,
      mappingVersion: {major: 2, minor: 0},
      mle: 240,
      mlc: 52,
      selectedFile: null,
    });
    expect(analyzeType4Cc(cc)).toMatchObject({
      status: 'supported',
      rawBytes: cc,
      selectedFile: {
        type: 4,
        length: 6,
        offset: 7,
        rawBytes: standard,
        fileId: 'E104',
        maxSize: 256,
        readAccess: 0,
        writeAccess: 255,
      },
    });
  });

  it('accepts minimum MLc1/MLe15 and preserves proprietary control without selecting it', () => {
    const bytes = withDescriptors([...proprietary, ...standard]);
    bytes[4] = 15;
    bytes[6] = 1;
    const parsed = analyzeType4Cc(bytes);
    expect(parsed.status).toBe('supported');
    expect(parsed.files.map(({type, fileId}) => [type, fileId])).toEqual([
      [5, 'E105'],
      [4, 'E104'],
    ]);
    expect(parsed.selectedFile.fileId).toBe('E104');
  });

  it.each([0x10, 0x21, 0x30])('preserves unsupported mapping %s', (version) => {
    const bytes = cc.slice();
    bytes[2] = version;
    expect(analyzeType4Cc(bytes)).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-mapping-version',
      selectedFile: null,
    });
  });

  it.each([
    [14, 240, 52],
    [15, 14, 52],
    [15, 240, 0],
  ])('rejects invalid header geometry %s/%s/%s', (length, mle, mlc) => {
    expect(analyzeType4Cc([0, length, 0x20, 0, mle, 0, mlc])).toMatchObject({
      status: 'malformed',
      reason: 'invalid-cc-header',
    });
  });

  it('rejects sparse bytes, extra bytes and preserves incomplete/capped CC', () => {
    expect(analyzeType4Cc(Array(7)).status).toBe('malformed');
    expect(analyzeType4Cc([...cc, 0]).status).toBe('malformed');
    expect(analyzeType4Cc(cc.slice(0, 12)).status).toBe('incomplete');
    expect(analyzeType4Cc([4, 1, ...cc.slice(2, 7)])).toMatchObject({
      status: 'unsupported',
      declaredLength: 1025,
      reason: 'cc-byte-limit',
    });
  });

  it.each(['0000', 'E102', 'E103', '3F00', '3FFF', 'FFFF'])(
    'rejects reserved NDEF FID %s',
    (fid) => {
      const bytes = cc.slice();
      bytes[9] = parseInt(fid.slice(0, 2), 16);
      bytes[10] = parseInt(fid.slice(2), 16);
      expect(analyzeType4Cc(bytes)).toMatchObject({
        status: 'malformed',
        reason: 'invalid-ndef-file-control',
        selectedFile: null,
      });
    },
  );

  it('distinguishes too-small malformed size and unsupported large short-offset profile', () => {
    const tooSmall = cc.slice();
    tooSmall[11] = 0;
    tooSmall[12] = 4;
    expect(analyzeType4Cc(tooSmall).status).toBe('malformed');
    const tooLarge = cc.slice();
    tooLarge[11] = 0x80;
    expect(analyzeType4Cc(tooLarge)).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-file-size',
      files: [{maxSize: 0x8000}],
    });
  });

  it.each([1, 0x7f, 0x80, 0xfe, 0xff])(
    'does not select nonfree/reserved read access %s',
    (access) => {
      const bytes = cc.slice();
      bytes[13] = access;
      expect(analyzeType4Cc(bytes)).toMatchObject({
        status: 'unsupported',
        reason: 'nonfree-read-access',
        selectedFile: null,
        files: [{readAccess: access, writeAccess: 255}],
      });
    },
  );

  it.each([
    [[...standard, ...standard], 'multiple-ndef-files'],
    [[...proprietary], 'missing-ndef-file-control'],
    [[6, 8, 0xe1, 4, 0, 0, 1, 0, 0, 255], 'extended-file-control'],
    [[...standard, 0, 0], 'unsupported-file-control-type'],
    [[...standard, 0xfe, 0], 'unsupported-file-control-type'],
    [[...standard, 0xfd, 1, 99], 'unsupported-file-control-type'],
  ])(
    'preserves unsupported descriptor forms without Type2/5 TLV assumptions',
    (descriptors, reason) => {
      const parsed = analyzeType4Cc(withDescriptors(descriptors));
      expect(parsed).toMatchObject({
        status: 'unsupported',
        reason,
        selectedFile: null,
      });
      expect(parsed.files.length).toBeGreaterThan(0);
    },
  );

  it.each(
    [
      [...standard, 5],
      [...standard, 5, 6, 1],
      [4, 5, 0xe1, 4, 1, 0, 0, 5, 0],
      [...standard, 6, 6, 0, 0, 0, 0, 0, 0],
    ].map((descriptors) => [descriptors]),
  )(
    'marks truncated/impossible descriptor lengths malformed',
    (descriptors) => {
      expect(analyzeType4Cc(withDescriptors(descriptors)).status).toBe(
        'malformed',
      );
    },
  );
});

describe('independent Type4 NDEF interpretation', () => {
  it('decodes normal and complete multirecord payloads without mutating raw bytes', () => {
    expect(
      analyzeType4Ndef({bytes: message, declaredLength: 8, complete: true}),
    ).toMatchObject({
      status: 'decoded',
      rawBytes: message,
      records: Ndef.decodeMessage(message),
    });
    const multi = Ndef.encodeMessage([
      Ndef.textRecord('One'),
      Ndef.uriRecord('https://example.com'),
    ]);
    expect(
      analyzeType4Ndef({
        bytes: multi,
        declaredLength: multi.length,
        complete: true,
      }).records,
    ).toEqual(Ndef.decodeMessage(multi));
    expect(message).toEqual([0xd1, 1, 4, 0x54, 2, 0x65, 0x6e, 0x78]);
  });

  it('separates empty, incomplete, exact-length contradiction and malformed record envelopes', () => {
    expect(
      analyzeType4Ndef({bytes: [], declaredLength: 0, complete: true}).status,
    ).toBe('empty');
    expect(
      analyzeType4Ndef({
        bytes: message.slice(0, 4),
        declaredLength: 8,
        complete: false,
      }),
    ).toMatchObject({
      status: 'incomplete',
      rawBytes: message.slice(0, 4),
      records: [],
    });
    expect(
      analyzeType4Ndef({
        bytes: message.slice(0, 4),
        declaredLength: 8,
        complete: true,
      }).status,
    ).toBe('malformed');
    expect(
      analyzeType4Ndef({bytes: message, declaredLength: 7, complete: false})
        .status,
    ).toBe('malformed');
    for (const invalid of [
      [0x51, 0, 0],
      [0x91, 0, 0],
      [0xd1, 1, 20, 0x54],
      [...message, 0],
    ]) {
      expect(
        analyzeType4Ndef({
          bytes: invalid,
          declaredLength: invalid.length,
          complete: true,
        }).status,
      ).toBe('malformed');
    }
  });

  it('preserves chunked NDEF as unsupported, without a false malformed claim', () => {
    const bytes = [0xb5, 0, 1, 0x78, 0x56, 0, 1, 0x79];
    expect(
      analyzeType4Ndef({bytes, declaredLength: bytes.length, complete: true}),
    ).toEqual({
      status: 'unavailable',
      rawBytes: bytes,
      records: [],
      reason: 'unsupported-ndef-chunking',
    });
  });
});

describe('portable Type4 report', () => {
  it('whitelists stable versioned keys, preserves unknowns/diagnostics, and deep clones', () => {
    const result = {
      status: 'partial',
      cancelled: false,
      platform: 'ios',
      metadataAcquisition: {
        method: 'none',
        automaticPlatformSelection: true,
        fullRfTrace: false,
      },
      application: {aid: 'D2760000850101', status: 'selected'},
      cc: analyzeType4Cc(cc),
      file: {nlen: null, chunks: [{offset: 2, bytes: message}]},
      consistency: {status: 'not-checked', atomicSnapshot: false},
      scope: {maxBytes: 8192},
      ndef: analyzeType4Ndef({
        bytes: message.slice(0, 4),
        declaredLength: 8,
        complete: false,
      }),
      transcript: [
        {
          sequence: 1,
          sw1: null,
          sw2: null,
          message: 'native',
          messageLength: 6,
          messageTruncated: false,
        },
      ],
      failure: {
        kind: 'transport-error',
        message: 'native',
        sw1: null,
        sw2: null,
      },
      type: 'script',
      commands: [[0xff]],
      timestamp: 'caller extra',
    };
    const report = createType4Report(result);
    expect(Object.keys(report)).toEqual([
      'schemaVersion',
      'kind',
      'status',
      'cancelled',
      'platform',
      'metadataAcquisition',
      'application',
      'cc',
      'file',
      'consistency',
      'scope',
      'ndef',
      'transcript',
      'failure',
    ]);
    expect(report).toMatchObject({
      schemaVersion: 1,
      kind: 'type4-ndef-inspection',
      file: {nlen: null},
      transcript: [{sw1: null, sw2: null, messageLength: 6}],
    });
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(createType4Report(result)),
    );
    report.file.chunks[0].bytes[0] = 0;
    expect(result.file.chunks[0].bytes[0]).toBe(0xd1);
    expect(report.commands).toBeUndefined();
    expect(report.type).toBeUndefined();
    expect(report.timestamp).toBeUndefined();
  });
});
