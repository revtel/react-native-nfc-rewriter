import {
  normalizeType5Uid,
  buildType5Frame,
  parseType5SystemInfo,
  parseType5Response,
} from '../src/features/type5-memory/protocol';

const display = 'E004010203040506';
const wire = [6, 5, 4, 3, 2, 1, 4, 0xe0];

describe('ISO15693 UID and readonly frames', () => {
  it.each([
    ['ios', display],
    ['android', display],
    ['android', '06050403020104e0'],
    ['android', wire],
  ])(
    'normalizes %s identifiers %s without mutating raw input',
    (platform, raw) => {
      const before = JSON.stringify(raw);
      expect(normalizeType5Uid(raw, platform)).toEqual({
        platformTagIdRaw: raw,
        uidDisplayBE: display,
        uidWireLE: wire,
        uidSource: 'platform',
      });
      expect(JSON.stringify(raw)).toBe(before);
    },
  );

  it.each(
    [
      null,
      'E004',
      'E0040102030405GG',
      'E0:04:01:02:03:04:05:06',
      [],
      [1, 2, 3, 4, 5, 6, 7, 256],
    ].map((raw) => [raw]),
  )('rejects malformed identifiers %s', (raw) => {
    expect(normalizeType5Uid(raw, 'android').uidWireLE).toBeNull();
  });

  it('rejects ambiguous Android endpoints and a reversed iOS ID', () => {
    expect(
      normalizeType5Uid('E0040102030405E0', 'android').uidWireLE,
    ).toBeNull();
    expect(
      normalizeType5Uid('0104010203040506', 'android').uidWireLE,
    ).toBeNull();
    expect(normalizeType5Uid('06050403020104E0', 'ios').uidWireLE).toBeNull();
  });

  it('constructs only exact addressed system info and u8 single-block frames', () => {
    expect(buildType5Frame(0x2b, wire)).toEqual([0x22, 0x2b, ...wire]);
    expect(buildType5Frame(0x20, wire, [255])).toEqual([
      0x22,
      0x20,
      ...wire,
      255,
    ]);
    for (const args of [
      [0x21, wire, [0]],
      [0x30, wire, [0]],
      [0x20, wire, [256]],
      [0x20, wire, [-1]],
      [0x20, wire, []],
      [0x2b, wire, [0]],
      [0x20, wire, [0], 0x62],
      [0x2b, []],
    ]) {
      expect(() => buildType5Frame(...args)).toThrow();
    }
  });
});

describe('standard system information', () => {
  it('parses all optional fields including zero AFI/DSFID', () => {
    expect(
      parseType5SystemInfo([0, 15, ...wire, 0, 0, 127, 3, 0x50]),
    ).toMatchObject({
      status: 'valid',
      uidWireLE: wire,
      dsfid: 0,
      afi: 0,
      blockCount: 128,
      blockSize: 4,
      icReference: 0x50,
      geometryTrusted: true,
    });
  });

  it('does not shift IC ref into omitted geometry and preserves explicit unknowns', () => {
    expect(parseType5SystemInfo([0, 11, ...wire, 0, 0, 0x51])).toMatchObject({
      status: 'valid',
      dsfid: 0,
      afi: 0,
      blockCount: null,
      blockSize: null,
      icReference: 0x51,
      geometryTrusted: false,
    });
    expect(parseType5SystemInfo([0, 0, ...wire])).toMatchObject({
      status: 'valid',
      dsfid: null,
      afi: null,
      blockCount: null,
      blockSize: null,
      icReference: null,
    });
  });

  it.each([
    [[0, 15, ...wire, 0, 0, 127], 'malformed', 'truncated-system-info'],
    [[0, 0, ...wire, 0], 'malformed', 'extra-system-info-bytes'],
    [[0, 4, ...wire, 127, 0xe3], 'malformed', 'reserved-block-size-bits'],
    [[0, 0x80, ...wire], 'unsupported', 'unsupported-information-flags'],
  ])(
    'rejects untrusted optional geometry but retains fixed UID',
    (raw, status, reason) => {
      expect(parseType5SystemInfo(raw)).toMatchObject({
        status,
        reason,
        uidWireLE: wire,
        geometryTrusted: false,
        blockCount: null,
        blockSize: null,
        rawResponse: raw,
      });
    },
  );

  it('does not infer identity from a truncated fixed header', () => {
    expect(parseType5SystemInfo([0, 4, 6, 5])).toMatchObject({
      status: 'malformed',
      uidWireLE: null,
      reason: 'truncated-system-info-header',
    });
  });

  it.each([1, 4, 32])(
    'accepts standard block size %s and count 256',
    (size) => {
      expect(
        parseType5SystemInfo([0, 4, ...wire, 255, size - 1]),
      ).toMatchObject({
        blockSize: size,
        blockCount: 256,
        geometryTrusted: true,
      });
    },
  );

  it('separates native-independent tag errors, unsupported flags and malformed frames', () => {
    expect(parseType5Response([1, 0x10])).toMatchObject({
      kind: 'tag-error',
      responseFlags: 1,
      tagErrorCode: 0x10,
    });
    for (const raw of [[], [0x40, 1], [1], [1, 2, 3], [0, -1], null]) {
      expect(parseType5Response(raw).kind).toBe('malformed-response');
    }
  });
});
