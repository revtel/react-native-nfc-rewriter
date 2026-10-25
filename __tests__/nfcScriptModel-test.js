import {
  makeStep,
  MAX_EXECUTED_STEPS,
  MAX_REPEAT,
  newScript,
  SCRIPT_VERSION,
  updateStepList,
  validateScript,
} from '../src/features/nfc-script/model';
import {
  parseExpression,
  resolveTemplate,
} from '../src/features/nfc-script/expressions';

describe('NFC script model', () => {
  test('creates a valid empty script for each supported technology', () => {
    expect(validateScript(newScript('NfcA'))).toEqual([]);
    expect(validateScript(newScript('IsoDep'))).toEqual([]);
  });

  test('edits a nested branch without mutating the previous tree', () => {
    const original = [makeStep('if')];
    const changed = updateStepList(
      original,
      [{index: 0, branch: 'then'}],
      (steps) => [...steps, makeStep('transceive')],
    );
    expect(original[0].then).toHaveLength(0);
    expect(changed[0].then).toHaveLength(1);
  });

  test('rejects unsupported and malformed scripts before RF', () => {
    expect(validateScript({...newScript(), version: 9})).toContain(
      'Unsupported script version',
    );
    expect(
      validateScript({
        ...newScript(),
        steps: [{type: 'javascript', code: 'alert(1)'}],
      }),
    ).toContain('Step 1: unknown step type');
    expect(
      validateScript({
        ...newScript(),
        steps: [{type: 'transceive', template: '30 ${missing:u8}'}],
      }),
    ).toContain('Step 1: unknown variable missing');
  });
});

describe('response assertion model', () => {
  const read = {type: 'transceive', template: '90 6A 00 00 00'};
  const check = makeStep('assert-response');
  const branch = (then, otherwise = []) => ({
    ...makeStep('if'), then, else: otherwise,
  });
  const repeat = (steps) => ({...makeStep('repeat'), steps});
  const validate = (steps) => validateScript({...newScript('IsoDep'), steps});

  test('provides an opt-in default without changing version or limits', () => {
    expect(check).toEqual({type: 'assert-response', source: 'data', length: 0});
    expect(SCRIPT_VERSION).toBe(1);
    expect(MAX_REPEAT).toBe(64);
    expect(MAX_EXECUTED_STEPS).toBe(500);
    expect(validate(Array.from({length: 24}, () => [read, check]).flat())).toEqual([]);
  });

  test.each([
    [branch([read]), check],
    [branch([read], [read]), check],
    [repeat([read]), check],
    [branch([read], [check])],
    [repeat([check, read])],
  ])('rejects responses available only on another lexical path: %p', (...steps) => {
    expect(validate(steps)).toEqual(
      expect.arrayContaining([expect.stringMatching(/no previous response to assert$/)]),
    );
  });

  test.each([
    [read, check],
    [branch([read, check])],
    [repeat([read, check])],
    [read, branch([check], [check]), repeat([check])],
  ])('accepts an earlier or inherited response in the same scope: %p', (...steps) => {
    expect(validate(steps)).toEqual([]);
  });

  test('a legacy __response user variable never impersonates a prior exchange', () => {
    const set = {type: 'set', name: '__response', expression: '7'};
    const capture = {...makeStep('capture'), name: '__response'};
    expect(validate([set])).toEqual([]);
    expect(validate([set, check])).toContain('Step 2: no previous response to assert');
    // Keep the old CAPTURE namespace behavior, while assertions use a separate flag.
    expect(validate([set, capture, check])).toContain('Step 3: no previous response to assert');
    expect(validate([read, capture, check])).toEqual([]);
  });

  test('validates assertions inside unexecuted branches and retains step labels', () => {
    expect(validate([read, branch([], [{...check, expectedHex: null}])])).toEqual([
      'Step 1: assertion bytes must be literal hex pairs',
    ]);
  });
});

describe('numeric expressions and command templates', () => {
  test('handles arithmetic without executing JavaScript', () => {
    expect(
      parseExpression('base + index * 4', {base: 0x20, index: 2}).value,
    ).toBe(0x28);
    expect(() => parseExpression('Math.random()', {})).toThrow();
    expect(() => parseExpression('base/2', {base: 4})).toThrow();
  });

  test('encodes integer widths and byte arrays', () => {
    expect(
      resolveTemplate('30 ${page:u8} ${offset:u16be} ${raw:bytes}', {
        page: 4,
        offset: 0x1234,
        raw: [0xaa, 0xbb],
      }),
    ).toEqual([0x30, 4, 0x12, 0x34, 0xaa, 0xbb]);
    expect(resolveTemplate('00 ${offset:u16le}', {offset: 0x1234})).toEqual([
      0, 0x34, 0x12,
    ]);
  });

  test('refuses truncation and missing values', () => {
    expect(() => resolveTemplate('30 ${page:u8}', {page: 256})).toThrow(
      'does not fit',
    );
    expect(() => resolveTemplate('30 ${missing:u8}', {})).toThrow(
      'Undefined variable',
    );
    expect(() => resolveTemplate('30 ${value:bytes}', {value: 3})).toThrow(
      'byte array',
    );
  });
});
