import {cloneJsonValue, canonicalJson, JsonValueError, utf8ByteLength} from './jsonValue';

const ARCHIVE_FORMAT = 'nfc-open-rewriter-records';
const ARCHIVE_VERSION = 1;
const ARCHIVE_LIMITS = Object.freeze({
  archiveBytes: 5 * 1024 * 1024,
  libraryBytes: 1024 * 1024,
  entries: 10000,
  depth: 64,
  nodes: 100000,
});

class ArchiveError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = 'ArchiveError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, details) {
  throw new ArchiveError(code, details);
}

function wrapJsonError(error) {
  if (!(error instanceof JsonValueError)) throw error;
  const codes = {
    'json-depth-limit': 'archive-depth-limit',
    'json-node-limit': 'archive-node-limit',
    'invalid-json-number': 'archive-number-loss',
    'invalid-json-value': 'archive-invalid-value',
    'invalid-utf8': 'archive-invalid-utf8',
  };
  fail(codes[error.code] || 'archive-invalid-value');
}

function boundedBytes(text, limit, code) {
  let size;
  try {
    size = utf8ByteLength(text, limit);
  } catch (error) {
    wrapJsonError(error);
  }
  if (size > limit) fail(code, {limit});
  return size;
}

// The value was already cloned/validated. Count JSON's escaped UTF-8 form
// before creating the serialized string, including large string/key contents.
function boundedJsonBytes(value, limit, code) {
  let bytes = 0;
  const add = (count) => {
    bytes += count;
    if (bytes > limit) fail(code, {limit});
  };
  const string = (text) => {
    add(2);
    for (let index = 0; index < text.length; index++) {
      const unit = text.charCodeAt(index);
      if (unit === 34 || unit === 92 || [8, 9, 10, 12, 13].includes(unit)) add(2);
      else if (unit < 32) add(6);
      else if (unit < 128) add(1);
      else if (unit < 2048) add(2);
      else if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { add(4); index += 1; }
        else add(6); // JSON escapes a lone UTF-16 surrogate.
      } else if (unit >= 0xdc00 && unit <= 0xdfff) add(6);
      else add(3);
    }
  };
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (current === null) add(4);
    else if (typeof current === 'string') string(current);
    else if (typeof current === 'boolean') add(current ? 4 : 5);
    else if (typeof current === 'number') add(JSON.stringify(current).length);
    else if (Array.isArray(current)) {
      add(2 + Math.max(0, current.length - 1));
      for (let index = current.length - 1; index >= 0; index--) stack.push(current[index]);
    } else {
      const keys = Object.keys(current);
      add(2 + Math.max(0, keys.length - 1));
      for (const key of keys) { string(key); add(1); stack.push(current[key]); }
    }
  }
  return bytes;
}

function decimalKey(token) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) fail('archive-invalid-json');
  let digits = (match[2] + (match[3] || '')).replace(/^0+/, '');
  if (!digits) return '0';
  const exponentText = match[4] || '0';
  const negativeExponent = exponentText[0] === '-';
  let exponent = 0;
  for (let index = /^[+-]/.test(exponentText) ? 1 : 0; index < exponentText.length; index++) {
    exponent = exponent * 10 + Number(exponentText[index]);
    // A nonzero finite Number cannot need an exponent exceeding its entire
    // bounded source mantissa plus this margin. Never expand exponent zeros.
    if (exponent > token.length + 1000) fail('archive-number-loss');
  }
  if (negativeExponent) exponent = -exponent;
  exponent -= (match[3] || '').length;
  const lastNonZero = digits.search(/0*$/);
  exponent += digits.length - lastNonZero;
  digits = digits.slice(0, lastNonZero);
  return `${match[1]}${digits}e${exponent}`;
}

function validateNumberToken(token) {
  const original = decimalKey(token);
  if (original === '0') {
    if (token[0] === '-') fail('archive-number-loss');
    return;
  }
  const number = Number(token);
  if (!Number.isFinite(number) || Object.is(number, -0)) fail('archive-number-loss');
  if (original !== decimalKey(JSON.stringify(number))) fail('archive-number-loss');
}

// Parse only grammar/structure/tokens here, before JSON.parse may lose a number.
// Recursion is bounded to 64 levels before descending into another value.
function preflightJson(text) {
  let cursor = 0;
  let nodes = 0;
  const digit = (index) => {
    const code = text.charCodeAt(index);
    return code >= 48 && code <= 57;
  };
  const white = () => {
    while (cursor < text.length) {
      const code = text.charCodeAt(cursor);
      if (code !== 32 && code !== 9 && code !== 10 && code !== 13) break;
      cursor += 1;
    }
  };
  const string = (decode = false) => {
    if (text[cursor++] !== '"') fail('archive-invalid-json');
    const parts = [];
    let segmentStart = cursor;
    while (cursor < text.length) {
      const code = text.charCodeAt(cursor++);
      if (code === 34) {
        if (decode) parts.push(text.slice(segmentStart, cursor - 1));
        return decode ? parts.join('') : null;
      }
      if (code < 32) fail('archive-invalid-json');
      if (code === 92) {
        if (decode) parts.push(text.slice(segmentStart, cursor - 1));
        const escaped = text[cursor++];
        if (escaped === 'u') {
          const hex = text.slice(cursor, cursor + 4);
          if (!/^[\da-fA-F]{4}$/.test(hex)) fail('archive-invalid-json');
          if (decode) parts.push(String.fromCharCode(Number.parseInt(hex, 16)));
          cursor += 4;
        } else {
          const escapes = {'"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t'};
          if (!Object.prototype.hasOwnProperty.call(escapes, escaped)) fail('archive-invalid-json');
          if (decode) parts.push(escapes[escaped]);
        }
        segmentStart = cursor;
      }
    }
    fail('archive-invalid-json');
  };
  const number = () => {
    const start = cursor;
    if (text[cursor] === '-') cursor += 1;
    if (text[cursor] === '0') cursor += 1;
    else {
      if (!(text.charCodeAt(cursor) >= 49 && text.charCodeAt(cursor) <= 57)) fail('archive-invalid-json');
      while (digit(cursor)) cursor += 1;
    }
    if (text[cursor] === '.') {
      cursor += 1;
      if (!digit(cursor)) fail('archive-invalid-json');
      while (digit(cursor)) cursor += 1;
    }
    if (text[cursor] === 'e' || text[cursor] === 'E') {
      cursor += 1;
      if (text[cursor] === '+' || text[cursor] === '-') cursor += 1;
      if (!digit(cursor)) fail('archive-invalid-json');
      while (digit(cursor)) cursor += 1;
    }
    validateNumberToken(text.slice(start, cursor));
  };
  const value = (depth) => {
    if (depth > ARCHIVE_LIMITS.depth) fail('archive-depth-limit', {limit: ARCHIVE_LIMITS.depth});
    nodes += 1;
    if (nodes > ARCHIVE_LIMITS.nodes) fail('archive-node-limit', {limit: ARCHIVE_LIMITS.nodes});
    white();
    const token = text[cursor];
    if (token === '"') string();
    else if (token === '[' || token === '{') {
      const object = token === '{';
      const end = object ? '}' : ']';
      const keys = object ? new Set() : null;
      cursor += 1;
      white();
      if (text[cursor] === end) { cursor += 1; return; }
      while (cursor < text.length) {
        if (object) {
          const key = string(true);
          if (keys.has(key)) fail('archive-duplicate-key');
          keys.add(key);
          white();
          if (text[cursor++] !== ':') fail('archive-invalid-json');
        }
        value(depth + 1);
        white();
        if (text[cursor] === end) { cursor += 1; return; }
        if (text[cursor++] !== ',') fail('archive-invalid-json');
        white();
      }
      fail('archive-invalid-json');
    } else if (token === '-' || digit(cursor)) number();
    else {
      const literal = ['true', 'false', 'null'].find((candidate) => text.startsWith(candidate, cursor));
      if (!literal) fail('archive-invalid-json');
      cursor += literal.length;
    }
  };
  white(); value(1); white();
  if (cursor !== text.length) fail('archive-invalid-json');
}

function normalizedEnvelope(records, metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('archive-invalid-metadata');
  if (!Array.isArray(records)) fail('archive-invalid-records');
  if (records.length > ARCHIVE_LIMITS.entries) fail('archive-entry-limit', {limit: ARCHIVE_LIMITS.entries});
  const exportedAt = metadata.exportedAt ?? '1970-01-01T00:00:00.000Z';
  const appVersion = metadata.appVersion ?? '';
  if (typeof exportedAt !== 'string' || typeof appVersion !== 'string') fail('archive-invalid-metadata');
  return {format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, exportedAt, appVersion, records};
}

function checkedEnvelope(records, metadata) {
  let envelope;
  try {
    envelope = cloneJsonValue(normalizedEnvelope(records, metadata), {
      maxDepth: ARCHIVE_LIMITS.depth, maxNodes: ARCHIVE_LIMITS.nodes,
    });
  } catch (error) {
    wrapJsonError(error);
  }
  boundedJsonBytes(envelope.records, ARCHIVE_LIMITS.libraryBytes, 'archive-library-bytes-limit');
  boundedJsonBytes(envelope, ARCHIVE_LIMITS.archiveBytes, 'archive-bytes-limit');
  return envelope;
}

function validateLibrary(records) {
  return checkedEnvelope(records).records;
}

function createArchive(records, metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('archive-invalid-metadata');
  return JSON.stringify(checkedEnvelope(records, {
    exportedAt: metadata.exportedAt ?? new Date().toISOString(),
    appVersion: metadata.appVersion ?? '',
  }));
}

function parseArchive(text) {
  if (typeof text !== 'string') fail('archive-invalid-json');
  boundedBytes(text, ARCHIVE_LIMITS.archiveBytes, 'archive-bytes-limit');
  preflightJson(text);
  let envelope;
  try { envelope = JSON.parse(text); } catch (_) { fail('archive-invalid-json'); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || envelope.format !== ARCHIVE_FORMAT) {
    fail('archive-format');
  }
  if (envelope.version !== ARCHIVE_VERSION) fail('archive-unsupported-version');
  const records = validateLibrary(envelope.records);
  // Optional metadata is display-only and is never persisted as record data.
  const displayMetadata = (field) => typeof envelope[field] === 'string' && envelope[field].length <= 128
    ? envelope[field] : null;
  return {records, metadata: {exportedAt: displayMetadata('exportedAt'), appVersion: displayMetadata('appVersion')}};
}

function createImportPlan(existing, incoming) {
  const current = validateLibrary(existing);
  const imported = validateLibrary(incoming);
  const existingCounts = new Map();
  current.forEach((entry) => {
    const key = canonicalJson(entry);
    existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
  });
  const seen = new Map();
  const additions = [];
  imported.forEach((entry) => {
    const key = canonicalJson(entry);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    if (occurrence > (existingCounts.get(key) || 0)) additions.push(entry);
  });
  const records = validateLibrary([...current, ...additions]);
  return {
    records,
    currentCount: current.length,
    incomingCount: imported.length,
    addedCount: additions.length,
    existingCount: imported.length - additions.length,
    finalCount: records.length,
  };
}

export {ARCHIVE_FORMAT, ARCHIVE_VERSION, ARCHIVE_LIMITS, ArchiveError, createArchive,
  parseArchive, validateLibrary, createImportPlan};
