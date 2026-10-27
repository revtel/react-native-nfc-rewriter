import {Buffer} from 'buffer';
import {
  buildTagPresentation,
  presentNdefRecord,
} from '../src/features/tag-result-presentation/model';

const bytes = (text) => Array.from(Buffer.from(text, 'utf8'));
const record = (payload, type = [0x54], extra = {}) => ({tnf: 1, type, id: [], payload, ...extra});
const text = (value, language = 'en') => record([language.length, ...bytes(language), ...bytes(value)]);
const uri = (value, prefix = 0) => record([prefix, ...bytes(value)], [0x55]);
const discovery = (records, extra = {}) => ({identifiers: [], technologies: [], ndef: {status: 'available', records}, ...extra});

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe('record content and technical evidence', () => {
  test('decodes complete multilingual UTF-8 Text and freezes the public shape', () => {
    const input = text('Hello 中文 日本語 😀', 'en-US');
    expect(presentNdefRecord(input)).toEqual({
      index: 0, kind: 'text', reason: null, tnf: 1, type: 'T', typeHex: '54', idHex: '',
      language: 'en-US', encoding: 'UTF-8', payloadByteCount: input.payload.length,
      payloadHex: input.payload.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '),
      content: 'Hello 中文 日本語 😀', mimeKind: null,
    });
  });

  test('keeps valid empty Text and zero-length reported language distinct from null', () => {
    expect(presentNdefRecord(text(''))).toMatchObject({kind: 'text', content: '', language: 'en', payloadByteCount: 3});
    expect(presentNdefRecord(text('hello', ''))).toMatchObject({kind: 'text', content: 'hello', language: ''});
    expect(presentNdefRecord(record([0]))).toMatchObject({kind: 'text', content: '', language: '', payloadByteCount: 1});
  });

  test('preserves UTF-16 evidence without guessing text or rejecting the encoding as malformed', () => {
    expect(presentNdefRecord(record([0x82, 0x65, 0x6e, 0, 0x41]))).toMatchObject({
      kind: 'unsupported', reason: 'utf16', encoding: 'UTF-16', language: 'en',
      content: null, payloadHex: '82 65 6E 00 41', payloadByteCount: 5,
    });
  });

  test('rejects malformed Text headers while retaining valid bytes and type evidence', () => {
    for (const payload of [[], [5, 0x65, 0x6e], [1, 0xff], [0x40, 0x41]]) {
      expect(presentNdefRecord(record(payload))).toMatchObject({kind: 'malformed', reason: 'invalid-text', content: null, type: 'T', typeHex: '54', payloadByteCount: payload.length});
    }
  });

  test('strictly rejects invalid scalar sequences instead of replacement or overlong decoding', () => {
    const invalid = [
      [0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xf0, 0x80, 0x80, 0xaf],
      [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80],
      [0xe2, 0x82], [0xe2, 0x28, 0xa1], [0x80], [0xff],
    ];
    for (const suffix of invalid) {
      expect(presentNdefRecord(record([0, ...suffix]))).toMatchObject({kind: 'malformed', reason: 'invalid-text', content: null});
      expect(presentNdefRecord(record([4, ...suffix], 'U'))).toMatchObject({kind: 'malformed', reason: 'invalid-uri', content: null});
    }
    const boundaries = '\u0000\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff\u{10000}\u{10ffff}';
    expect(presentNdefRecord(text(boundaries)).content).toBe(boundaries);
  });

  test('reconstructs valid URI prefix 0, https and final table entry 35 verbatim', () => {
    expect(presentNdefRecord(uri('HTTPS://Example.com/%20'))).toMatchObject({kind: 'uri', content: 'HTTPS://Example.com/%20', encoding: 'UTF-8'});
    expect(presentNdefRecord(uri('example.com/中文', 4))).toMatchObject({kind: 'uri', content: 'https://example.com/中文'});
    expect(presentNdefRecord(uri('example', 35))).toMatchObject({kind: 'uri', content: 'urn:nfc:example'});
    expect(presentNdefRecord(uri('my-app+foo.bar:opaque'))).toMatchObject({kind: 'uri', content: 'my-app+foo.bar:opaque'});
  });

  test('rejects unknown URI prefixes, missing schemes and whitespace/control destinations', () => {
    for (const input of [
      record([], 'U'), record([0], 'U'), record([4], 'U'), record([35], 'U'),
      uri('example.com'), uri('1bad:value'),
      uri('example', 36), uri('example', 255), uri('https://example.com/a b'),
      uri('https://example.com/\n'), uri('https://example.com/\u0000'),
      uri('https://example.com/\u007f'), uri('https://example.com/\u0085'),
      uri('https://example.com/\u009f'), uri('https://example.com/\u00a0'),
    ]) {
      expect(presentNdefRecord(input)).toMatchObject({kind: 'malformed', reason: 'invalid-uri', content: null});
    }
  });

  test('treats type strings literally and keeps non-ASCII byte types as hex', () => {
    expect(presentNdefRecord({...text('Hi'), type: 'T'})).toEqual(presentNdefRecord(text('Hi')));
    expect(presentNdefRecord(record([], '54'))).toMatchObject({kind: 'unknown', reason: 'unrecognized', type: '54', typeHex: '35 34', content: null});
    expect(presentNdefRecord(record([], [0xff, 0x54]))).toMatchObject({kind: 'unknown', type: null, typeHex: 'FF 54', payloadHex: ''});
    expect(presentNdefRecord(record([1], '字'))).toMatchObject({kind: 'malformed', reason: 'invalid-type', type: null, typeHex: null, payloadByteCount: 1});
    expect(presentNdefRecord(record([1], 'T\u2028'))).toMatchObject({kind: 'malformed', reason: 'invalid-type', type: null, typeHex: null, payloadByteCount: 1});
  });

  test('classifies only real MIME TNF without decoding credential/contact/binary payloads', () => {
    for (const [type, mimeKind] of [
      ['APPLICATION/vnd.wfa.wsc', 'wifi'], ['text/vcard', 'contact'],
      ['TEXT/X-VCARD', 'contact'], ['application/octet-stream', 'other'], ['text/plain', 'other'],
    ]) {
      const input = record([0xff, 0, 1], type, {tnf: 2});
      expect(presentNdefRecord(input)).toMatchObject({kind: 'mime', reason: null, type, mimeKind, content: null, payloadHex: 'FF 00 01'});
      expect(presentNdefRecord({...input, tnf: 4})).toMatchObject({kind: 'unknown', reason: 'unrecognized', mimeKind: null, content: null});
    }
    for (const type of ['', 'text', 'text/', '/plain', 'text/pla in', 'text/plain\n', [0xff]]) {
      expect(presentNdefRecord(record([], type, {tnf: 2}))).toMatchObject({kind: 'malformed', reason: 'invalid-type', mimeKind: null});
    }
  });

  test('preserves each valid technical field when another record field is malformed', () => {
    const input = record([0, 0xaa], 'T', {id: [1, 2]});
    expect(presentNdefRecord({...input, tnf: 8})).toMatchObject({kind: 'malformed', reason: 'invalid-tnf', tnf: null, type: 'T', typeHex: '54', idHex: '01 02', payloadByteCount: 2, payloadHex: '00 AA'});
    expect(presentNdefRecord({...input, type: null})).toMatchObject({reason: 'invalid-type', tnf: 1, idHex: '01 02', payloadHex: '00 AA'});
    expect(presentNdefRecord({...input, payload: null})).toMatchObject({reason: 'invalid-payload', typeHex: '54', idHex: '01 02', payloadByteCount: null, payloadHex: null});
    expect(presentNdefRecord({...input, id: null})).toMatchObject({reason: 'invalid-id', idHex: null, payloadHex: '00 AA'});
    const {id, ...withoutId} = text('Hi');
    expect(presentNdefRecord(withoutId).idHex).toBeNull();
    expect(presentNdefRecord({...withoutId, id: []}).idHex).toBe('');
    expect(presentNdefRecord({...withoutId, id: undefined}).reason).toBe('invalid-id');
  });

  test('normalizes native Android hex IDs and iOS byte IDs without changing raw records', () => {
    for (const input of [text('Android Text 中文'), uri('example.com', 4)]) {
      for (const [androidId, iosId, expectedHex] of [
        ['', [], ''], ['A1B2', [0xa1, 0xb2], 'A1 B2'],
        ['a1b2', [0xa1, 0xb2], 'A1 B2'], ['84', [0x84], '84'],
      ]) {
        const android = freeze({...input, id: androidId});
        const ios = freeze({...input, id: iosId});
        const before = JSON.stringify({android, ios});
        expect(presentNdefRecord(android)).toEqual(presentNdefRecord(ios));
        expect(presentNdefRecord(android)).toMatchObject({
          kind: input.type[0] === 0x54 ? 'text' : 'uri', reason: null, idHex: expectedHex,
        });
        expect(JSON.stringify({android, ios})).toBe(before);
        expect(android.id).toBe(androidId);
      }
    }
    expect(presentNdefRecord({...text('Hi'), tnf: 8, id: 'a1b2'})).toMatchObject({
      reason: 'invalid-tnf', idHex: 'A1 B2', payloadHex: '02 65 6E 48 69',
    });
  });

  test('rejects malformed native ID strings rather than trimming or guessing encodings', () => {
    for (const id of ['A', 'A1B', 'GG', 'A1 B2', ' A1', 'A1 ', '0xA1',
      'A1\n', 'A1B2\r\n', 'A1\tB2', 'A1\u2028', 'Ａ１']) {
      expect(presentNdefRecord({...text('Hi'), id})).toMatchObject({
        kind: 'malformed', reason: 'invalid-id', idHex: null,
        type: 'T', typeHex: '54', payloadHex: '02 65 6E 48 69', content: null,
      });
    }
  });

  test('refuses sparse and invalid byte arrays without coercion in every byte field', () => {
    for (const bad of [Array(1), [-1], [256], [0.5], ['84'], [true], [undefined], 'not-bytes']) {
      expect(presentNdefRecord({...text('Hi'), type: typeof bad === 'string' ? 84 : bad}).reason).toBe('invalid-type');
      expect(presentNdefRecord({...text('Hi'), payload: bad}).reason).toBe('invalid-payload');
      expect(presentNdefRecord({...text('Hi'), id: bad}).reason).toBe('invalid-id');
    }
    for (const bad of [null, undefined, [], false, 'record']) {
      expect(presentNdefRecord(bad)).toMatchObject({index: 0, kind: 'malformed', reason: 'invalid-record', content: null});
    }
  });

  test('returns full long content and literal types without argument-count spread failures', () => {
    const long = 'a'.repeat(131073) + '😀';
    expect(presentNdefRecord(text(long)).content).toBe(long);
    expect(presentNdefRecord(record([], 'x'.repeat(131073))).type).toHaveLength(131073);
  });
});

describe('scan observation summary', () => {
  test('keeps ordered records and sparse positions, identifiers, technologies and tag fields', () => {
    const records = Array(4);
    records[0] = text('first');
    records[2] = uri('https://example.com');
    records[3] = record([1], 'application/vnd.wfa.wsc', {tnf: 4});
    const tag = {id: 'aBcD', ndefMessage: records, custom: {retained: true}, atqa: [0, 4]};
    const observed = discovery(records, {identifiers: [{kind: 'idm', value: '00aa'}, {kind: 'id', value: 'aBcD'}], technologies: ['IsoDep', 'NfcA']});
    const result = buildTagPresentation(tag, observed);
    expect(result.recordsState).toBe('provided');
    expect(result.recordCount).toBe(4);
    expect(result.records.map(({index, kind}) => [index, kind])).toEqual([[0, 'text'], [1, 'malformed'], [2, 'uri'], [3, 'unknown']]);
    expect(result.records[1].reason).toBe('invalid-record');
    expect(result.identifiers).toEqual(observed.identifiers);
    expect(result.technologies).toEqual(['IsoDep', 'NfcA']);
    expect(result.tagFields.map(({name}) => name)).toEqual(['id', 'custom', 'atqa']);
    expect(result.tagFields[1].value).toBe(tag.custom);
    expect(result.tagFields[2].value).toBe(tag.atqa);
  });

  test('separates available empty, missing, unavailable and invalid native records', () => {
    expect(buildTagPresentation({ndefMessage: []}, discovery([]))).toMatchObject({recordsState: 'not-provided', recordCount: 0, records: []});
    expect(buildTagPresentation({}, {ndef: {status: 'unknown', records: []}})).toMatchObject({recordsState: 'unavailable', recordCount: null, records: []});
    expect(buildTagPresentation({}, {ndef: {status: 'available'}})).toMatchObject({recordsState: 'unavailable', recordCount: null});
    for (const ndefMessage of [null, undefined, '[]', {}]) {
      expect(buildTagPresentation({ndefMessage}, discovery([]))).toMatchObject({recordsState: 'invalid', recordCount: null});
    }
    const result = buildTagPresentation({ndefMessage: null}, discovery([text('still supplied')]));
    expect(result.recordsState).toBe('invalid');
    expect(result.recordCount).toBeNull();
    expect(result.records[0].content).toBe('still supplied');
  });

  test('uses exact status codes and capacity only for 2/3 positive safe integers', () => {
    const present = (status, capacity) => buildTagPresentation({ndefStatus: {status, capacity}}, discovery([])).ndef;
    expect(present(2, 1024)).toEqual({status: 'system-readwrite', capacity: 1024});
    expect(present(3, 32)).toEqual({status: 'system-readonly', capacity: 32});
    expect(present(1, 0)).toEqual({status: 'unconfirmed', capacity: null});
    expect(present(1, 1024)).toEqual({status: 'unconfirmed', capacity: null});
    for (const status of [undefined, null, 0, '2', true, 4]) {
      expect(present(status, 1024)).toEqual({status: 'unknown', capacity: null});
    }
    for (const capacity of [undefined, null, 0, -1, '1024', true, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(present(2, capacity)).toEqual({status: 'system-readwrite', capacity: null});
      expect(present(3, capacity)).toEqual({status: 'system-readonly', capacity: null});
    }
    expect(present(2, Number.MAX_SAFE_INTEGER).capacity).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('never infers metadata or message size from payloads, tag type or legacy top-level fields', () => {
    const tag = {type: 'NFC Forum Type 2', maxSize: 1024, isWritable: true, ndefMessage: [text('hello')]};
    const result = buildTagPresentation(tag, discovery(tag.ndefMessage, {technologies: ['Ndef']}));
    expect(result.ndef).toEqual({status: 'unknown', capacity: null});
    expect(result.records[0].payloadByteCount).toBe(8);
    expect(Object.keys(result)).toEqual(['identifiers', 'technologies', 'recordsState', 'recordCount', 'ndef', 'tagFields', 'records']);
  });

  test('handles absent/malformed plain input and leaves frozen native data unchanged', () => {
    for (const input of [null, undefined, false, 'tag', []]) {
      expect(() => buildTagPresentation(input, input)).not.toThrow();
      expect(buildTagPresentation(input, input)).toMatchObject({identifiers: [], technologies: [], recordsState: 'unavailable', recordCount: null, ndef: {status: 'unknown', capacity: null}, records: []});
    }
    const records = [text('immutable'), uri('example.com', 4)];
    const tag = freeze({id: 'raw UID', ndefMessage: records, ndefStatus: {status: 2, capacity: 256}, custom: [1, {nested: 'value'}]});
    const observed = freeze(discovery(records, {identifiers: [{kind: 'id', value: tag.id}], technologies: ['NfcA', 'Ndef']}));
    const before = JSON.stringify({tag, observed});
    const result = buildTagPresentation(tag, observed);
    expect(buildTagPresentation(tag, observed)).toEqual(result);
    expect(JSON.stringify({tag, observed})).toBe(before);
    expect(result.records[0].content).toBe('immutable');
    expect(result.identifiers).not.toBe(observed.identifiers);
    expect(result.technologies).not.toBe(observed.technologies);
  });
});

test('fresh and raw records take precedence over unavailable native records while retaining native fields', () => {
  const native = Object.freeze({id: 'RAW', ndefMessage: null});
  for (const source of ['android-ndef-read', 'type5-raw-read']) {
    const records = [text('acquired')];
    const acquisition = {source, status: 'available', records, evidence: {scope: 'limited'}};
    const result = buildTagPresentation(native, {ndef: {status: 'available', records}, ndefAcquisition: acquisition});
    expect(result).toMatchObject({recordsState: 'provided', recordCount: 1, ndefAcquisition: acquisition});
    expect(result.records[0].content).toBe('acquired');
    expect(native.ndefMessage).toBeNull();
  }
});
