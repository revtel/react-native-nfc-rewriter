import {
  ARCHIVE_FORMAT, ARCHIVE_LIMITS, ArchiveError,
  createArchive, parseArchive, validateLibrary, createImportPlan,
} from '../src/features/record-library/archive';
import {canonicalJson, cloneJsonValue, jsonValuesEqual, utf8ByteLength} from '../src/features/record-library/jsonValue';
import golden from './fixtures/record-library/mixed-v1.json';

const envelope = (records) => `{"format":"${ARCHIVE_FORMAT}","version":1,"records":${records}}`;
function expectCode(operation, code) {
  try { operation(); throw new Error('Expected rejection'); } catch (error) {
    expect(error).toBeInstanceOf(ArchiveError);
    expect(error.code).toBe(code);
  }
}
function nested(levels) {
  let value = null;
  for (let index = 0; index < levels; index++) value = [value];
  return value;
}

test('mixed version1 archive round-trips every entry, repeated occurrence and unknown own key', () => {
  const parsed = parseArchive(JSON.stringify(golden));
  expect(parsed.records).toEqual(golden.records);
  expect(parsed.metadata).toEqual({exportedAt: golden.exportedAt, appVersion: golden.appVersion});
  const exported = createArchive(parsed.records, parsed.metadata);
  expect(parseArchive(exported)).toEqual(parsed);
  const unknown = parseArchive(exported).records[7];
  expect(Object.prototype.hasOwnProperty.call(unknown, '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(unknown)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(unknown, '__proto__').value).toEqual({keep: 'own key'});
  expect({}.keep).toBeUndefined();
});

test('snapshot cloning isolates nested contents and does not invoke accessors/toJSON', () => {
  const original = [{payload: {value: [1, {x: 'before'}]}}];
  const copy = validateLibrary(original);
  copy[0].payload.value[1].x = 'after';
  expect(original[0].payload.value[1].x).toBe('before');
  const getter = jest.fn(() => 'private');
  const value = Object.defineProperty({}, 'value', {get: getter, enumerable: true});
  expectCode(() => createArchive([value]), 'archive-invalid-value');
  expect(getter).not.toHaveBeenCalled();
  const toJSON = jest.fn(() => 'changed');
  expectCode(() => createArchive([{toJSON}]), 'archive-invalid-value');
  expect(toJSON).not.toHaveBeenCalled();
});

test.each([undefined, NaN, Infinity, -Infinity, -0, 1n, Symbol('x'), () => {}])('unsupported JS values are rejected without silent JSON conversion: %p', (value) => {
  expect(() => cloneJsonValue(value)).toThrow();
  expect(() => createArchive([value])).toThrow();
});

test('cycles, sparse arrays and exotic objects are rejected; shared JSON objects are independently copied', () => {
  const cycle = {}; cycle.self = cycle;
  expectCode(() => createArchive([cycle]), 'archive-invalid-value');
  expectCode(() => createArchive([new Array(2)]), 'archive-invalid-value');
  expectCode(() => createArchive([new Date()]), 'archive-invalid-value');
  const shared = {a: 1};
  const copy = cloneJsonValue([shared, shared]);
  copy[0].a = 2;
  expect(copy[1].a).toBe(1);
  expect(shared.a).toBe(1);
});

test.each(['9007199254740993','0.10000000000000001','1e309','1e-9999','-0','-0.0','-0e0','4e-324'])('numeric information loss is rejected before JSON.parse: %s', (token) => {
  const parse = jest.spyOn(JSON, 'parse');
  try {
    expectCode(() => parseArchive(envelope(`[${token}]`)), 'archive-number-loss');
    expect(parse).not.toHaveBeenCalled();
  } finally { parse.mockRestore(); }
});

test.each(['1','1.0','1e0','1E+0000','0','0.0e999999999999999999999999','0.1','1e20','9007199254740992','5e-324','1.7976931348623157e308'])('stable app numeric values and equivalent decimal spellings are preserved: %s', (token) => {
  const value = parseArchive(envelope(`[${token}]`)).records[0];
  expect(value).toBe(Number(token));
  expect(parseArchive(createArchive([value])).records).toEqual([value]);
});

test('very long exponents do not allocate exponent-sized values', () => {
  const token = `1e${'9'.repeat(50000)}`;
  expectCode(() => parseArchive(envelope(`[${token}]`)), 'archive-number-loss');
});

test.each(['', ' ', '{', '{"a":1,}', '[1,]', '{"records":[]}', '[]', 'null', 'com.revteltech.nfcopenrewriter://share?data={}'])('invalid documents are not archives: %s', (text) => {
  expect(() => parseArchive(text)).toThrow(ArchiveError);
});

test('future versions and invalid records have separate stable error codes', () => {
  expectCode(() => parseArchive(JSON.stringify({...golden, version: 2})), 'archive-unsupported-version');
  expectCode(() => parseArchive(JSON.stringify({...golden, version: '1'})), 'archive-unsupported-version');
  expectCode(() => parseArchive(JSON.stringify({...golden, records: {}})), 'archive-invalid-records');
  expectCode(() => parseArchive(JSON.stringify({...golden, format: 'other'})), 'archive-format');
});

test('empty archives remain valid data with a no-write merge plan', () => {
  const parsed = parseArchive(createArchive([]));
  expect(parsed.records).toEqual([]);
  expect(createImportPlan([1], parsed.records)).toEqual({
    records: [1], currentCount: 1, incomingCount: 0, addedCount: 0, existingCount: 0, finalCount: 1,
  });
});

test('archive actual UTF-8 byte limit is enforced before JSON.parse, including whitespace', () => {
  const base = envelope('[]');
  const atLimit = base + ' '.repeat(ARCHIVE_LIMITS.archiveBytes - base.length);
  expect(parseArchive(atLimit).records).toEqual([]);
  const parse = jest.spyOn(JSON, 'parse');
  try {
    expectCode(() => parseArchive(atLimit + ' '), 'archive-bytes-limit');
    expect(parse).not.toHaveBeenCalled();
  } finally { parse.mockRestore(); }
});

test('compact library UTF-8 boundary includes supplementary Unicode and is not character length', () => {
  const records = ['🏷'.repeat((ARCHIVE_LIMITS.libraryBytes - 4) / 4)];
  expect(utf8ByteLength(JSON.stringify(records))).toBe(ARCHIVE_LIMITS.libraryBytes);
  expect(parseArchive(createArchive(records)).records).toEqual(records);
  expectCode(() => createArchive([records[0] + 'a']), 'archive-library-bytes-limit');
});

test('full normalized envelope reserves the extra depth level for metadata', () => {
  const atLimit = [nested(61)];
  expect(parseArchive(createArchive(atLimit)).records).toEqual(atLimit);
  expectCode(() => createArchive([nested(62)]), 'archive-depth-limit');
  const parse = jest.spyOn(JSON, 'parse');
  try {
    expectCode(() => parseArchive(envelope(JSON.stringify([nested(62)]))), 'archive-depth-limit');
    expect(parse).not.toHaveBeenCalled();
  } finally { parse.mockRestore(); }
});

test('full envelope counts metadata nodes on export and reimport', () => {
  const atLimit = [Array(99993).fill(null)];
  expect(parseArchive(createArchive(atLimit)).records[0]).toHaveLength(99993);
  expectCode(() => createArchive([Array(99994).fill(null)]), 'archive-node-limit');
  // A minimal input header can fit but must also fit the normalized output header.
  expectCode(() => parseArchive(envelope(JSON.stringify([Array(99994).fill(null)]))), 'archive-node-limit');
});

test('unknown metadata consumes input structural budgets without becoming record data', () => {
  expectCode(() => parseArchive(JSON.stringify({...golden, extra: nested(64)})), 'archive-depth-limit');
  const withMetadata = JSON.stringify({...golden, extra: 'ignored', appVersion: {not: 'display text'}});
  expect(parseArchive(withMetadata).records).toEqual(golden.records);
  expect(parseArchive(withMetadata).metadata.appVersion).toBeNull();
});

test('entry limit and merged-library limits are checked without changing inputs', () => {
  expect(validateLibrary(Array(10000).fill(0))).toHaveLength(10000);
  expectCode(() => validateLibrary(Array(10001).fill(0)), 'archive-entry-limit');
  const first = ['a'.repeat(600000)];
  const second = ['b'.repeat(600000)];
  expectCode(() => createImportPlan(first, second), 'archive-library-bytes-limit');
  expect(first).toEqual(['a'.repeat(600000)]);
  const left = Array.from({length: 6000}, (_, index) => index);
  const right = Array.from({length: 6000}, (_, index) => index + 6000);
  expectCode(() => createImportPlan(left, right), 'archive-entry-limit');
});

test('error diagnostics contain codes and support budgets, never file/record contents', () => {
  const marker = 'PRIVATE-CONTENT-SHOULD-NOT-LOG';
  let error;
  try { parseArchive(envelope(`["${marker}",9007199254740993]`)); } catch (caught) { error = caught; }
  expect(String(error)).not.toContain(marker);
  expect(JSON.stringify(error)).not.toContain(marker);
});

test('canonical object keys ignore insertion order while array order and unknown fields remain significant', () => {
  expect(canonicalJson({b: 2, a: [1, 2]})).toBe('{"a":[1,2],"b":2}');
  expect(jsonValuesEqual({b: 2, a: 1}, {a: 1, b: 2})).toBe(true);
  expect(jsonValuesEqual([1, 2], [2, 1])).toBe(false);
  expect(jsonValuesEqual({a: 1}, {a: 1, future: true})).toBe(false);
});

test('occurrence merge preserves deliberate duplicates and repeated import is idempotent', () => {
  const a = {name: 'same', payload: {tech: 'Ndef', value: 'A'}};
  const b = {name: 'same', payload: {tech: 'Ndef', value: 'B'}};
  const initial = createImportPlan([], [a, a]);
  expect(initial.records).toEqual([a, a]);
  expect(initial.addedCount).toBe(2);
  expect(createImportPlan(initial.records, [a, a])).toMatchObject({addedCount: 0, existingCount: 2, finalCount: 2});
  expect(createImportPlan([a], [a, b, a])).toEqual({
    records: [a, b, a], currentCount: 1, incomingCount: 3, addedCount: 2, existingCount: 1, finalCount: 3,
  });
});

test('opaque JSON merge keeps existing order and appends only missing occurrences in file order', () => {
  const first = JSON.parse('{"__proto__":{"x":1},"b":2}');
  const equivalent = JSON.parse('{"b":2,"__proto__":{"x":1}}');
  const result = createImportPlan([first, null, null], [equivalent, 4, null, [2, 1], equivalent, null, null]);
  expect(result.records).toEqual([first, null, null, 4, [2, 1], equivalent, null]);
  expect(result).toMatchObject({currentCount: 3, incomingCount: 7, addedCount: 4, existingCount: 3, finalCount: 7});
  result.records[0].b = 3;
  expect(first.b).toBe(2);
});

test.each([
  '{"name":"first","name":"second"}',
  '{"name":"first","\\u006eame":"second"}',
  '{"a/b":1,"a\\/b":2}',
  '{"a\\nb":1,"a\\u000ab":2}',
  '{"🏷":1,"\\ud83c\\udff7":2}',
  '{"\\ud800":1,"\\uD800":2}',
])('ambiguous decoded duplicate keys are rejected before JSON.parse: %s', (entry) => {
  const parse = jest.spyOn(JSON, 'parse');
  try {
    expectCode(() => parseArchive(envelope(`[${entry}]`)), 'archive-duplicate-key');
    expect(parse).not.toHaveBeenCalled();
  } finally { parse.mockRestore(); }
});

test('duplicate envelope version cannot be hidden by last-wins parsing', () => {
  expectCode(() => parseArchive(`{"format":"${ARCHIVE_FORMAT}","version":2,"version":1,"records":[]}`), 'archive-duplicate-key');
  expect(parseArchive(envelope('[{"same":1},{"same":2}]')).records).toEqual([{same: 1}, {same: 2}]);
});

test('escaped quotes, backslashes and surrogate strings survive without prototype changes', () => {
  const records = [JSON.parse('{"a\\"b\\\\c":"line\\n\\t\\u0001","\\ud800":"\\udfff"}')];
  expect(parseArchive(createArchive(records)).records).toEqual(records);
  expectCode(() => parseArchive(envelope('["\ud800"]')), 'archive-invalid-utf8');
});

test.each(['["\\u123"]','["\\q"]','[01]','[1.]','[1e]','[+1]','[true false]'])('malformed lexical forms are rejected: %s', (records) => {
  expectCode(() => parseArchive(envelope(records)), 'archive-invalid-json');
});

test('export metadata cannot change envelope shape or allocate arbitrary untrusted objects', () => {
  expectCode(() => createArchive([], null), 'archive-invalid-metadata');
  expectCode(() => createArchive([], {appVersion: {value: 'unknown'}}), 'archive-invalid-metadata');
});

test('export rejects excessive encoded string bytes before serializing the library', () => {
  const stringify = jest.spyOn(JSON, 'stringify');
  try {
    expectCode(() => createArchive(['x'.repeat(ARCHIVE_LIMITS.libraryBytes)]), 'archive-library-bytes-limit');
    expect(stringify).not.toHaveBeenCalled();
  } finally { stringify.mockRestore(); }
});

test('JSON escape expansion is included in library byte eligibility before serialization', () => {
  const value = '\u0001'.repeat((ARCHIVE_LIMITS.libraryBytes - 4) / 6);
  expect(parseArchive(createArchive([value])).records).toEqual([value]);
  expectCode(() => createArchive([value + '\u0001']), 'archive-library-bytes-limit');
});
