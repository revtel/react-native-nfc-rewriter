import {
  makeStep,
  newScript,
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
