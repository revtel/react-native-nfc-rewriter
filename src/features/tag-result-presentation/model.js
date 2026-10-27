/* eslint-disable no-bitwise -- NDEF status and UTF-8 sequences use bit fields. */
const URI_PREFIXES = [
  '', 'http://www.', 'https://www.', 'http://', 'https://', 'tel:',
  'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.', 'ftps://', 'sftp://',
  'smb://', 'nfs://', 'ftp://', 'dav://', 'news:', 'telnet://', 'imap:',
  'rtsp://', 'urn:', 'pop:', 'sip:', 'sips:', 'tftp:', 'btspp://',
  'btl2cap://', 'btgoep://', 'tcpobex://', 'irdaobex://', 'file://',
  'urn:epc:id:', 'urn:epc:tag:', 'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:',
  'urn:nfc:',
];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function isBytes(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index++) {
    if (!hasOwn(value, index) || !Number.isInteger(value[index]) || value[index] < 0 || value[index] > 255) {
      return false;
    }
  }
  return true;
}

function hex(bytes) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function idValue(value) {
  if (isBytes(value)) {
    return {valid: true, hex: hex(value)};
  }
  if (typeof value !== 'string' || value.length % 2 !== 0) {
    return {valid: false, hex: null};
  }
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (!((code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) ||
        (code >= 0x61 && code <= 0x66))) {
      return {valid: false, hex: null};
    }
  }
  const pairs = [];
  for (let index = 0; index < value.length; index += 2) {
    pairs.push(value.slice(index, index + 2).toUpperCase());
  }
  return {valid: true, hex: pairs.join(' ')};
}

function ascii(bytes) {
  const characters = [];
  for (const byte of bytes) {
    if (byte > 127) {
      return null;
    }
    characters.push(String.fromCharCode(byte));
  }
  return characters.join('');
}

function typeValue(value) {
  if (typeof value === 'string') {
    const bytes = [];
    for (let index = 0; index < value.length; index++) {
      const byte = value.charCodeAt(index);
      if (byte > 127) {
        return {valid: false, text: null, hex: null};
      }
      bytes.push(byte);
    }
    return {valid: true, text: value, hex: hex(bytes)};
  }
  if (isBytes(value)) {
    return {valid: true, text: ascii(value), hex: hex(value)};
  }
  return {valid: false, text: null, hex: null};
}

function hasUriWhitespaceOrControls(content) {
  if (/\s/.test(content)) {
    return true;
  }
  for (const character of content) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

// Decode complete, validated scalar sequences; never substitute a replacement.
function utf8(bytes) {
  const characters = [];
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index++];
    let remaining;
    let minimum;
    let codePoint;
    if (first <= 0x7f) {
      characters.push(String.fromCodePoint(first));
      continue;
    } else if (first >= 0xc2 && first <= 0xdf) {
      remaining = 1;
      minimum = 0x80;
      codePoint = first & 0x1f;
    } else if (first >= 0xe0 && first <= 0xef) {
      remaining = 2;
      minimum = 0x800;
      codePoint = first & 0x0f;
    } else if (first >= 0xf0 && first <= 0xf4) {
      remaining = 3;
      minimum = 0x10000;
      codePoint = first & 0x07;
    } else {
      return null;
    }
    if (index + remaining > bytes.length) {
      return null;
    }
    for (let count = 0; count < remaining; count++) {
      const next = bytes[index++];
      if ((next & 0xc0) !== 0x80) {
        return null;
      }
      codePoint = (codePoint << 6) | (next & 0x3f);
    }
    if (codePoint < minimum || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return null;
    }
    characters.push(String.fromCodePoint(codePoint));
  }
  return characters.join('');
}

function presentNdefRecord(record, index = 0) {
  const object = isObject(record) ? record : {};
  const type = typeValue(object.type);
  const validTnf = Number.isInteger(object.tnf) && object.tnf >= 0 && object.tnf <= 7;
  const validPayload = isBytes(object.payload);
  const hasId = hasOwn(object, 'id');
  const id = hasId ? idValue(object.id) : {valid: true, hex: null};
  const result = {
    index,
    kind: 'unknown',
    reason: 'unrecognized',
    tnf: validTnf ? object.tnf : null,
    type: type.text,
    typeHex: type.hex,
    idHex: id.hex,
    language: null,
    encoding: null,
    payloadByteCount: validPayload ? object.payload.length : null,
    payloadHex: validPayload ? hex(object.payload) : null,
    content: null,
    mimeKind: null,
  };
  const malformed = (reason) => ({...result, kind: 'malformed', reason});
  if (!isObject(record)) {
    return malformed('invalid-record');
  }
  if (!validTnf) {
    return malformed('invalid-tnf');
  }
  if (!type.valid) {
    return malformed('invalid-type');
  }
  if (!validPayload) {
    return malformed('invalid-payload');
  }
  if (!id.valid) {
    return malformed('invalid-id');
  }
  const payload = object.payload;
  if (object.tnf === 1 && type.text === 'T') {
    if (payload.length === 0) {
      return malformed('invalid-text');
    }
    result.encoding = payload[0] & 0x80 ? 'UTF-16' : 'UTF-8';
    const languageLength = payload[0] & 0x3f;
    if (languageLength + 1 > payload.length) {
      return malformed('invalid-text');
    }
    result.language = ascii(payload.slice(1, languageLength + 1));
    if (result.language === null || (payload[0] & 0x40) !== 0) {
      return malformed('invalid-text');
    }
    if (result.encoding === 'UTF-16') {
      return {...result, kind: 'unsupported', reason: 'utf16'};
    }
    const content = utf8(payload.slice(languageLength + 1));
    return content === null
      ? malformed('invalid-text')
      : {...result, kind: 'text', reason: null, content};
  }
  if (object.tnf === 1 && type.text === 'U') {
    result.encoding = 'UTF-8';
    if (payload.length < 2 || payload[0] >= URI_PREFIXES.length) {
      return malformed('invalid-uri');
    }
    const suffix = utf8(payload.slice(1));
    if (suffix === null) {
      return malformed('invalid-uri');
    }
    const content = URI_PREFIXES[payload[0]] + suffix;
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(content) || hasUriWhitespaceOrControls(content)) {
      return malformed('invalid-uri');
    }
    return {...result, kind: 'uri', reason: null, content};
  }
  if (object.tnf === 2) {
    if (type.text === null || /\s/.test(type.text) || !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(type.text)) {
      return malformed('invalid-type');
    }
    const lower = type.text.toLowerCase();
    const mimeKind = lower === 'application/vnd.wfa.wsc'
      ? 'wifi'
      : ['text/vcard', 'text/x-vcard'].includes(lower) ? 'contact' : 'other';
    return {...result, kind: 'mime', reason: null, mimeKind};
  }
  return result;
}

function buildTagPresentation(tag, discovery) {
  const source = isObject(tag) ? tag : {};
  const observation = isObject(discovery) ? discovery : {};
  const supplied = observation.ndef?.records;
  const records = Array.isArray(supplied) ? supplied : [];
  let recordsState = 'unavailable';
  let recordCount = null;
  const acquired = observation.ndefAcquisition?.status === 'available' &&
    ['android-ndef-read', 'type5-raw-read'].includes(observation.ndefAcquisition.source) &&
    Array.isArray(observation.ndefAcquisition.records);
  if (!acquired && hasOwn(source, 'ndefMessage') && !Array.isArray(source.ndefMessage)) {
    recordsState = 'invalid';
  } else if (observation.ndef?.status === 'available' && Array.isArray(supplied)) {
    recordsState = records.length ? 'provided' : 'not-provided';
    recordCount = records.length;
  }
  const reported = isObject(source.ndefStatus) ? source.ndefStatus : {};
  const status = reported.status === 2
    ? 'system-readwrite'
    : reported.status === 3
    ? 'system-readonly'
    : reported.status === 1 ? 'unconfirmed' : 'unknown';
  const capacity = (reported.status === 2 || reported.status === 3) &&
    Number.isSafeInteger(reported.capacity) && reported.capacity > 0
    ? reported.capacity : null;
  return {
    identifiers: Array.isArray(observation.identifiers)
      ? observation.identifiers.filter((identifier) => isObject(identifier) &&
          ['id', 'idm'].includes(identifier.kind) && typeof identifier.value === 'string')
          .map(({kind, value}) => ({kind, value})) : [],
    technologies: Array.isArray(observation.technologies)
      ? observation.technologies.filter((technology) => typeof technology === 'string') : [],
    recordsState,
    recordCount,
    ndef: {status, capacity},
    ...(observation.ndefAcquisition ? {ndefAcquisition: observation.ndefAcquisition} : {}),
    tagFields: Object.entries(source)
      .filter(([name]) => name !== 'ndefMessage')
      .map(([name, value]) => ({name, value})),
    records: Array.from(records, (record, index) =>
      presentNdefRecord(hasOwn(records, index) ? record : undefined, index)),
  };
}

export {buildTagPresentation, presentNdefRecord};
