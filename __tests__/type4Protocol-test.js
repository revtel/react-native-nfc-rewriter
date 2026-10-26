import {
  buildType4SelectApplication,
  buildType4SelectFile,
  buildType4ReadBinary,
  validateType4Command,
  normalizeType4Response,
  boundedDiagnostic,
  isBytes,
} from '../src/features/type4-ndef/protocol';

const file = {type: 4, length: 6, fileId: 'E104', maxSize: 256, readAccess: 0};
const context = {
  phase: 'read-ndef',
  fileId: 'E104',
  selectedFile: file,
  fileSize: 256,
  offset: 2,
  length: 8,
  planStart: 2,
  planEnd: 10,
};

describe('fixed Type4 short APDU policy', () => {
  it('constructs exact modern application/CC/NDEF/read commands', () => {
    expect(buildType4SelectApplication()).toEqual([
      0, 0xa4, 4, 0, 7, 0xd2, 0x76, 0, 0, 0x85, 1, 1, 0,
    ]);
    expect(buildType4SelectFile('E103')).toEqual([0, 0xa4, 0, 12, 2, 0xe1, 3]);
    expect(buildType4SelectFile('E104', file)).toEqual([
      0, 0xa4, 0, 12, 2, 0xe1, 4,
    ]);
    expect(buildType4ReadBinary(context)).toEqual([0, 0xb0, 0, 2, 8]);
    expect(
      buildType4ReadBinary({fileId: 'E103', fileSize: 7, offset: 0, length: 7}),
    ).toEqual([0, 0xb0, 0, 0, 7]);
  });

  it.each(['0000', 'E102', '3F00', '3FFF', 'FFFF', 'e104', '123', 'GGGG'])(
    'rejects unvalidated/reserved FID %s',
    (fileId) => {
      expect(() => buildType4SelectFile(fileId, {...file, fileId})).toThrow();
    },
  );

  it('never selects a proprietary, nonfree, invalid-size, or mismatched descriptor', () => {
    for (const descriptor of [
      null,
      {...file, type: 5},
      {...file, readAccess: 0x80},
      {...file, maxSize: 4},
      {...file, maxSize: 0x8000},
      {...file, fileId: 'E105'},
    ]) {
      expect(() => buildType4SelectFile('E104', descriptor)).toThrow();
    }
  });

  it.each([
    {length: 0},
    {length: 241},
    {length: 256},
    {length: 1.5},
    {offset: -1},
    {offset: 0x8000},
    {offset: 2.5},
    {offset: 0},
    {offset: 9, length: 2},
    {fileSize: 257},
    {planEnd: 257},
    {planStart: -1},
    {fileId: 'E105'},
  ])('rejects out-of-file/plan/short-APDU read %s', (override) => {
    expect(() => buildType4ReadBinary({...context, ...override})).toThrow();
  });

  it('validates commands against state/context and rejects fallback or arbitrary instructions', () => {
    expect(
      validateType4Command(buildType4SelectApplication(), {
        phase: 'select-application',
      }),
    ).toBe(true);
    expect(validateType4Command(buildType4ReadBinary(context), context)).toBe(
      true,
    );
    for (const command of [
      [0, 0xc0, 0, 0, 8],
      [0, 0xd6, 0, 2, 8],
      [0, 0xb0, 0, 2, 9],
      [...buildType4SelectApplication().slice(0, -2), 0, 0],
    ]) {
      expect(() => validateType4Command(command, context)).toThrow();
    }
    expect(() =>
      validateType4Command([0, 0xb0, 0, 2, 8], {
        ...context,
        phase: 'get-response',
      }),
    ).toThrow();
  });
});

describe('bounded platform APDU normalization', () => {
  it.each(['ios', 'android'])(
    'accepts empty SELECT response and bounded FCI on %s',
    (platform) => {
      const raw =
        platform === 'ios' ? {response: [], sw1: 0x90, sw2: 0} : [0x90, 0];
      expect(normalizeType4Response(raw, platform)).toMatchObject({
        valid: true,
        data: [],
        sw1: 0x90,
        sw2: 0,
        responseBytes: [0x90, 0],
        responseLength: 2,
        responseTruncated: false,
      });
      const fci =
        platform === 'ios'
          ? {response: [0x6f, 0], sw1: 0x90, sw2: 0}
          : [0x6f, 0, 0x90, 0];
      expect(normalizeType4Response(fci, platform).data).toEqual([0x6f, 0]);
    },
  );

  it.each([0x61, 0x6c, 0x69])(
    'preserves non-success status %s without retry interpretation',
    (sw1) => {
      expect(normalizeType4Response([7, sw1, 0x82], 'android')).toMatchObject({
        valid: true,
        data: [7],
        sw1,
        sw2: 0x82,
        responseBytes: [7, sw1, 0x82],
      });
    },
  );

  it('never invents missing or malformed iOS SW, or a complete response length', () => {
    for (const raw of [
      {response: [1, 2]},
      {response: [], sw1: -1, sw2: 0},
      {response: [], sw1: 0x90, sw2: 300},
    ]) {
      const normalized = normalizeType4Response(raw, 'ios');
      expect(normalized.valid).toBe(false);
      expect(normalized.responseLength).toBeNull();
      expect(normalized.responseTruncated).toBe(true);
      expect(normalized.sw1 === null || normalized.sw2 === null).toBe(true);
    }
    expect(
      normalizeType4Response({response: null, sw1: 0x90, sw2: 0}, 'ios'),
    ).toMatchObject({valid: false, responseLength: null, responseBytes: null});
  });

  it.each([[[]], [[0x90]], [null], [[1, undefined, 0x90, 0]], [[0x90, -1]]])(
    'rejects invalid Android byte shape %s',
    (raw) => {
      expect(normalizeType4Response(raw, 'android').valid).toBe(false);
    },
  );

  it('rejects sparse arrays and clearly labels malformed prefixes as incomplete evidence', () => {
    expect(isBytes(Array(2))).toBe(false);
    expect(
      normalizeType4Response([1, undefined, 3, 0x90, 0], 'android'),
    ).toMatchObject({
      valid: false,
      data: [1],
      responseBytes: [1, 0x90, 0],
      responseLength: 5,
      responseTruncated: true,
    });
    expect(
      normalizeType4Response({response: [1, 256, 3], sw1: 0x90, sw2: 0}, 'ios'),
    ).toMatchObject({valid: false, data: [1], responseTruncated: true});
  });

  it.each(['android', 'ios'])(
    'caps oversized %s data while retaining original length and observed SW',
    (platform) => {
      const bytes = Array(10000).fill(7);
      const raw =
        platform === 'ios'
          ? {response: bytes, sw1: 0x69, sw2: 0x82}
          : [...bytes, 0x69, 0x82];
      const normalized = normalizeType4Response(raw, platform);
      expect(normalized).toMatchObject({
        valid: false,
        sw1: 0x69,
        sw2: 0x82,
        responseLength: 10002,
        responseTruncated: true,
        reason: 'response-data-limit',
      });
      expect(normalized.data).toHaveLength(256);
      expect(normalized.responseBytes).toHaveLength(258);
    },
  );

  it('caps native diagnostics without losing their original text length', () => {
    const message = 'x'.repeat(9000);
    expect(boundedDiagnostic(new Error(message))).toEqual({
      message: message.slice(0, 4096),
      messageLength: 9000,
      messageTruncated: true,
    });
    expect(boundedDiagnostic(null)).toEqual({
      message: null,
      messageLength: null,
      messageTruncated: false,
    });
  });
});
