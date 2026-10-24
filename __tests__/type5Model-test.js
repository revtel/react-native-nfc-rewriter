import Ndef from 'react-native-nfc-manager/ndef-lib';
import {analyzeType5Memory} from '../src/features/type5-memory/model';
import {createType5Report} from '../src/features/type5-memory/report';

function analyze(
  bytes,
  {blockSize = 1, reportedBlocks = 8192, geometryTrusted = true} = {},
) {
  const blocks = [];
  for (let i = 0; i + blockSize <= bytes.length; i += blockSize) {
    blocks.push({address: blocks.length, bytes: bytes.slice(i, i + blockSize)});
  }
  return analyzeType5Memory({
    blocks,
    blockSize,
    reportedBlocks,
    geometryTrusted,
  });
}

describe('Type5 capability container', () => {
  it.each([0xe1, 0xe2])(
    'uses MLEN rather than magic %s to select four bytes',
    (magic) => {
      expect(analyze([magic, 0x40, 0x3f, 0]).cc).toMatchObject({
        status: 'supported',
        length: 4,
        dataStart: 4,
        dataLength: 504,
        dataEnd: 508,
        mappingVersion: {major: 1, minor: 0},
        readAccess: 0,
        writeAccess: 0,
      });
    },
  );

  it('uses 16bit big endian MLEN and includes CC in end', () => {
    expect(analyze([0xe2, 0x40, 0, 1, 0, 0, 3, 255]).cc).toMatchObject({
      status: 'supported',
      length: 8,
      mlen: 1023,
      dataStart: 8,
      dataLength: 8184,
      dataEnd: 8192,
    });
  });

  it('detects physical conflict without truncating self-declared bounds', () => {
    const result = analyze([0xe1, 0x40, 64, 0], {reportedBlocks: 512});
    expect(result.cc).toMatchObject({
      status: 'inconsistent',
      dataEnd: 516,
      dataLength: 512,
    });
    expect(result.ndef.status).toBe('unavailable');
    expect(
      analyze([0xe1, 0x40, 64, 0], {
        reportedBlocks: null,
        geometryTrusted: false,
      }).cc.status,
    ).toBe('supported');
  });

  it.each([
    [[], 'unavailable'],
    [[1, 2, 3, 4], 'not-type5'],
    [[0xe1], 'incomplete'],
    [[0xe2, 0x40, 0, 1], 'incomplete'],
    [[0xe2, 0x40, 0, 1, 1, 0, 0, 10], 'malformed'],
    [[0xe2, 0x40, 0, 1, 0, 0, 0, 0], 'malformed'],
    [[0xe1, 0x44, 10, 0], 'malformed'],
    [[0xe1, 0x41, 10, 0], 'malformed'],
    [[0xe1, 0x50, 10, 0], 'unsupported'],
    [[0xe1, 0x48, 10, 0], 'unsupported'],
    [[0xe1, 0x40, 10, 0x80], 'unsupported'],
  ])('preserves distinct invalid/unsupported CC states', (bytes, status) => {
    expect(analyze(bytes).cc.status).toBe(status);
  });

  it('only consumes contiguous verified address/length data', () => {
    const blocks = [
      {address: 0, bytes: [0xe1, 0x40, 1, 0]},
      {address: 2, bytes: [3, 0, 0xfe, 0]},
    ];
    expect(analyzeType5Memory({blocks, blockSize: 4}).ndef.status).toBe(
      'incomplete',
    );
  });
});

describe('bounded Type5 TLV and complete NDEF', () => {
  const cc = [0xe1, 0x40, 0x3f, 0];
  it('decodes every record using the existing decoder within a partial memory prefix', () => {
    const records = [
      Ndef.textRecord('Hello'),
      Ndef.uriRecord('https://example.com'),
    ];
    const encoded = Ndef.encodeMessage(records);
    const {ndef} = analyze([
      ...cc,
      0,
      0xfd,
      2,
      99,
      98,
      3,
      encoded.length,
      ...encoded,
      0xfe,
      3,
      255,
    ]);
    expect(ndef.status).toBe('decoded');
    expect(ndef.records).toEqual(Ndef.decodeMessage(encoded));
    expect(ndef.records).toHaveLength(2);
    expect(ndef.tlvs.map(({type}) => type)).toEqual([0, 0xfd, 3, 0xfe]);
    expect(ndef.tlvs[2]).toMatchObject({
      offset: 9,
      declaredLength: encoded.length,
      complete: true,
    });
  });

  it('retains an empty initialized NDEF and absent terminated area', () => {
    expect(analyze([...cc, 3, 0, 0xfe]).ndef).toMatchObject({
      status: 'empty',
      rawBytes: [],
      records: [],
    });
    expect(analyze([...cc, 0xfd, 1, 7, 0xfe]).ndef.status).toBe('absent');
  });

  it('preserves unknown TLV evidence without claiming the whole tag is malformed', () => {
    expect(analyze([...cc, 0x42, 2, 7, 8]).ndef).toMatchObject({
      status: 'unavailable',
      reason: 'unsupported-tlv-type',
      tlvs: [
        {
          type: 0x42,
          offset: 4,
          declaredLength: 2,
          bytes: [7, 8],
          complete: true,
        },
      ],
    });
  });

  it('decodes a true extended-length payload', () => {
    const encoded = Ndef.encodeMessage([Ndef.textRecord('x'.repeat(260))]);
    expect(encoded.length).toBeGreaterThan(255);
    expect(
      analyze([
        ...cc,
        3,
        255,
        Math.floor(encoded.length / 256),
        encoded.length % 256,
        ...encoded,
      ]).ndef.status,
    ).toBe('decoded');
  });

  it.each([
    [[3], 'incomplete', 'incomplete-tlv-header'],
    [[3, 255, 1], 'incomplete', 'incomplete-tlv-header'],
    [[3, 5, 0xd1], 'incomplete', 'incomplete-tlv-payload'],
    [[3, 255, 2, 0], 'malformed', 'tlv-exceeds-data-area'],
    [[3, 4, 0xd1, 1, 20, 0x54], 'malformed', 'malformed-ndef-message'],
  ])(
    'separates incomplete physical evidence from contradictory declared lengths',
    (body, status, reason) => {
      expect(analyze([...cc, ...body]).ndef).toMatchObject({
        status,
        reason,
        records: [],
      });
    },
  );

  it('never reads a TLV length outside the declared area', () => {
    expect(
      analyze([0xe1, 0x40, 1, 0, ...Array(7).fill(0), 3, 0]).ndef,
    ).toMatchObject({
      status: 'malformed',
      reason: 'tlv-header-exceeds-data-area',
    });
  });

  it('rejects incomplete record envelopes even inside a complete TLV', () => {
    for (const message of [
      [0x51, 0, 0],
      [0x91, 0, 0],
      [0xd1, 0, 0, 0],
      [0xf1, 0, 0],
    ]) {
      expect(analyze([...cc, 3, message.length, ...message]).ndef.status).toBe(
        'malformed',
      );
    }
  });

  it('preserves valid chunked NDEF as unsupported rather than malformed', () => {
    const chunked = [0xb5, 0, 1, 0x78, 0x56, 0, 1, 0x79];
    expect(analyze([...cc, 3, chunked.length, ...chunked]).ndef).toMatchObject({
      status: 'unavailable',
      reason: 'unsupported-ndef-chunking',
      rawBytes: chunked,
      records: [],
      tlvs: [
        {
          type: 3,
          offset: 4,
          declaredLength: chunked.length,
          bytes: chunked,
          complete: true,
        },
      ],
    });
  });
});

describe('portable Type5 report', () => {
  it('has deterministic versioned keys, explicit unknowns and independent raw evidence', () => {
    const result = {
      status: 'partial',
      cancelled: false,
      platform: 'ios',
      metadataRead: {
        method: 'getTag',
        mayReadNdef: true,
        includedInRawReadBounds: false,
      },
      tag: {uidDisplayBE: 'E004010203040506'},
      systemInfo: {afi: null},
      scope: {plannedBlocks: 2, readBlocks: 1},
      blocks: [{address: 0, bytes: [1, 2]}],
      failure: {
        kind: 'transport-error',
        message: 'native diagnostic',
        tagErrorCode: null,
      },
      ...analyze([1, 2]),
      type: 'script',
      commands: [[0xff]],
    };
    const report = createType5Report(result);
    expect(Object.keys(report)).toEqual([
      'schemaVersion',
      'kind',
      'status',
      'cancelled',
      'platform',
      'metadataRead',
      'tag',
      'systemInfo',
      'scope',
      'blocks',
      'failure',
      'cc',
      'ndef',
    ]);
    expect(report).toMatchObject({
      schemaVersion: 1,
      kind: 'iso15693-inspection',
      metadataRead: {
        method: 'getTag',
        mayReadNdef: true,
        includedInRawReadBounds: false,
      },
      systemInfo: {afi: null},
      failure: {tagErrorCode: null, message: 'native diagnostic'},
    });
    expect(report.type).toBeUndefined();
    expect(report.commands).toBeUndefined();
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(createType5Report(result)),
    );
    report.blocks[0].bytes[0] = 255;
    expect(result.blocks[0].bytes).toEqual([1, 2]);
  });
});
