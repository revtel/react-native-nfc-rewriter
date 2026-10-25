import {
  assertionFailureMessage,
  evaluateResponseAssertion,
  parseAssertionHex,
  validateResponseAssertion,
} from '../src/features/nfc-script/responseAssertions';
import {normalizeResponse} from '../src/features/nfc-script/interpreter';

const assertion = (fields = {}) => ({
  type: 'assert-response',
  source: 'data',
  length: 0,
  ...fields,
});
const validate = (fields, tech = 'IsoDep', hasResponse = true) =>
  validateResponseAssertion(assertion(fields), tech, hasResponse);

describe('literal assertion schema', () => {
  test('parses byte pairs and explicit empty bytes without template evaluation', () => {
    expect(parseAssertionHex(' \n0a\tFF 00 ')).toEqual([10, 255, 0]);
    expect(parseAssertionHex('')).toEqual([]);
    expect(parseAssertionHex(' \t\n')).toEqual([]);
  });

  test.each([null, undefined, 0, [], {}, 'A', '0xAA', 'AABB', 'AA-BB',
    '${uid:bytes}', 'AA ??', 'AA, BB', 'AA\nB']) (
    'rejects non-literal input %p',
    (value) => {
      expect(() => parseAssertionHex(value)).toThrow(
        'assertion bytes must be literal hex pairs',
      );
    },
  );

  test.each([null, undefined, '', '0', -1, 0.5, 4097, NaN, Infinity])(
    'rejects invalid exact length %p',
    (length) => {
      expect(validate({length})).toContain('assertion length must be 0–4096');
    },
  );

  test('requires the response, source and length and preserves independent errors', () => {
    expect(validateResponseAssertion({}, 'IsoDep', false)).toEqual([
      'no previous response to assert',
      'invalid assertion source',
      'assertion length must be 0–4096',
    ]);
    expect(validate({source: 'sw'})).toContain('invalid assertion source');
    expect(validate({length: 4096})).toEqual([]);
  });

  test('optional fields use own presence, including invalid null/undefined', () => {
    expect(validate({})).toEqual([]);
    expect(validate({expectedHex: ''})).toEqual([]);
    for (const expectedHex of [null, undefined]) {
      expect(validate({expectedHex})).toContain(
        'assertion bytes must be literal hex pairs',
      );
    }
    for (const expectedSw of [null, undefined, '', 0x9100, '0x9100', '91 00', '9100\n']) {
      expect(validate({expectedSw})).toContain(
        'assertion status must be four hex digits',
      );
    }
    const inherited = Object.assign(Object.create({expectedHex: null, expectedSw: null}), assertion());
    expect(validateResponseAssertion(inherited, 'NfcA', true)).toEqual([]);
    expect(evaluateResponseAssertion(inherited, normalizeResponse('NfcA', [])))
      .toMatchObject({expectedHex: null, expectedSw: null, checks: {bytes: null, sw: null}});
  });

  test('requires whole expected length and consistent raw status bytes', () => {
    expect(validate({length: 1, expectedHex: ''})).toEqual([
      'assertion bytes must match the expected length',
    ]);
    expect(validate({source: 'raw', length: 1})).toEqual([
      'ISO-DEP raw assertion length must include SW1/SW2',
    ]);
    expect(validate({source: 'raw', length: 2, expectedHex: '91 00', expectedSw: '9000'}))
      .toEqual(['assertion bytes conflict with expected status']);
    expect(validate({source: 'raw', length: 2, expectedHex: '91 af', expectedSw: '91aF'}))
      .toEqual([]);
    expect(validate({expectedSw: '9100'}, 'NfcA')).toEqual([
      'assertion status requires IsoDep',
    ]);
  });
});

describe('complete response evaluation', () => {
  test('records exact empty ISO-DEP evidence and disabled optional checks', () => {
    const response = normalizeResponse('IsoDep', [0x91, 0]);
    expect(evaluateResponseAssertion(assertion({expectedHex: '', expectedSw: '9100'}), response))
      .toEqual({source: 'data', expectedLength: 0, actualLength: 0, expectedHex: '',
        actualHex: '', actualHexTruncated: false, expectedSw: '9100', actualSw: '9100',
        checks: {length: true, bytes: true, sw: true}, passed: true, failure: null});
    const result = evaluateResponseAssertion(assertion(), response);
    expect(result).toMatchObject({expectedHex: null, expectedSw: null,
      checks: {length: true, bytes: null, sw: null}});
    expect(assertionFailureMessage(result)).toBeNull();
  });

  test('distinguishes raw/data lengths and normalizes hex and status', () => {
    const response = normalizeResponse('IsoDep', [4, 1, 1, 1, 0, 0x16, 5, 0x91, 0xaf]);
    expect(evaluateResponseAssertion(assertion({length: 7, expectedSw: '91af'}), response))
      .toMatchObject({actualLength: 7, actualHex: '04 01 01 01 00 16 05', expectedSw: '91AF', actualSw: '91AF', passed: true});
    expect(evaluateResponseAssertion(assertion({source: 'raw', length: 9}), response))
      .toMatchObject({actualLength: 9, passed: true});
  });

  test('evaluates every enabled comparison and prioritizes length, status, bytes', () => {
    const step = assertion({length: 1, expectedHex: '04', expectedSw: '9100'});
    const evaluate = (raw) => evaluateResponseAssertion(step, normalizeResponse('IsoDep', raw));
    const length = evaluate([5, 6, 0x6a, 0x82]);
    expect(length.checks).toEqual({length: false, bytes: false, sw: false});
    expect(length.failure).toBe('length');
    expect(assertionFailureMessage(length)).toBe('Response length mismatch: expected 1, received 2');
    const status = evaluate([5, 0x6a, 0x82]);
    expect(status.checks).toEqual({length: true, bytes: false, sw: false});
    expect(status.failure).toBe('status');
    expect(assertionFailureMessage(status)).toBe('Response status mismatch: expected 9100, received 6A82');
    const bytes = evaluate([5, 0x91, 0]);
    expect(bytes.failure).toBe('bytes');
    expect(assertionFailureMessage(bytes)).toBe('Response bytes do not match expected bytes');
  });

  test('NfcA raw and data use the same bytes and have no SW', () => {
    for (const source of ['raw', 'data']) {
      expect(evaluateResponseAssertion(assertion({source, length: 1, expectedHex: 'aA'}), normalizeResponse('NfcA', [0xaa])))
        .toMatchObject({actualHex: 'AA', expectedHex: 'AA', actualSw: null, passed: true});
    }
  });

  test('bounds only preview and cannot accept an expected prefix with extra bytes', () => {
    const raw = Object.freeze([...Array(4096).fill(4), 5, 0x91, 0]);
    const response = normalizeResponse('IsoDep', raw);
    Object.freeze(response.raw);
    Object.freeze(response.data);
    Object.freeze(response);
    const step = Object.freeze(assertion({length: 4096, expectedHex: Array(4096).fill('04').join(' ')}));
    const result = evaluateResponseAssertion(step, response);
    expect(result).toMatchObject({actualLength: 4097, actualHexTruncated: true,
      checks: {length: false, bytes: false, sw: null}, failure: 'length'});
    expect(result.actualHex.split(' ')).toHaveLength(4096);
    expect(response.raw).toEqual(raw);
    expect(response.data).toHaveLength(4097);
    expect(evaluateResponseAssertion(assertion({length: 4096}), normalizeResponse('NfcA', Array(4096).fill(0))).actualHexTruncated)
      .toBe(false);
  });

  test('defensively refuses a missing response', () => {
    expect(() => evaluateResponseAssertion(assertion(), null)).toThrow(
      'No previous response to assert',
    );
  });
});
