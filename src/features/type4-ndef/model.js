/* eslint-disable no-bitwise -- Mapping and NDEF record headers use bit fields. */
import Ndef from 'react-native-nfc-manager/ndef-lib';
import {isBytes, MAX_CC_BYTES, validType4FileId} from './protocol';

function emptyType4Cc() {
  return {
    status: 'unavailable',
    rawBytes: [],
    declaredLength: null,
    mappingVersion: null,
    mle: null,
    mlc: null,
    files: [],
    selectedFile: null,
    reason: null,
  };
}

function emptyType4Ndef() {
  return {status: 'unavailable', rawBytes: [], records: [], reason: null};
}

function analyzeType4Cc(bytes) {
  const cc = emptyType4Cc();
  if (!isBytes(bytes)) {
    return {...cc, status: 'malformed', reason: 'invalid-cc-bytes'};
  }
  cc.rawBytes = bytes.slice(0, MAX_CC_BYTES);
  if (bytes.length === 0) {
    return cc;
  }
  if (bytes.length >= 2) {
    cc.declaredLength = bytes[0] * 256 + bytes[1];
  }
  if (bytes.length >= 3) {
    cc.mappingVersion = {major: bytes[2] >> 4, minor: bytes[2] & 15};
  }
  if (bytes.length >= 5) {
    cc.mle = bytes[3] * 256 + bytes[4];
  }
  if (bytes.length >= 7) {
    cc.mlc = bytes[5] * 256 + bytes[6];
  }
  if (bytes.length < 7) {
    return {...cc, status: 'incomplete', reason: 'incomplete-cc-header'};
  }
  if (cc.declaredLength < 15 || cc.mle < 15 || cc.mlc < 1) {
    return {...cc, status: 'malformed', reason: 'invalid-cc-header'};
  }
  if (cc.declaredLength > MAX_CC_BYTES) {
    return {...cc, status: 'unsupported', reason: 'cc-byte-limit'};
  }
  if (bytes[2] !== 0x20) {
    return {
      ...cc,
      status: 'unsupported',
      reason: 'unsupported-mapping-version',
    };
  }
  if (bytes.length < cc.declaredLength) {
    return {...cc, status: 'incomplete', reason: 'incomplete-cc'};
  }
  if (bytes.length > cc.declaredLength) {
    return {...cc, status: 'malformed', reason: 'extra-cc-bytes'};
  }
  let cursor = 7;
  let unsupported = null;
  let malformed = null;
  while (cursor < bytes.length) {
    const offset = cursor;
    const type = bytes[cursor++];
    const length = cursor < bytes.length ? bytes[cursor++] : null;
    const end = length === null ? cursor : cursor + length;
    const entry = {
      type,
      length,
      offset,
      rawBytes: bytes.slice(offset, Math.min(end, bytes.length)),
      fileId: null,
      maxSize: null,
      readAccess: null,
      writeAccess: null,
    };
    cc.files.push(entry);
    if (length === null || end > bytes.length) {
      malformed = 'truncated-file-control';
      break;
    }
    if ((type === 4 || type === 5) && length !== 6) {
      malformed = malformed || 'invalid-file-control-length';
    } else if (type === 6 && length !== 8) {
      malformed = malformed || 'invalid-file-control-length';
    } else if (type === 4 || type === 5 || type === 6) {
      entry.fileId = bytes
        .slice(cursor, cursor + 2)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      const sizeLength = type === 6 ? 4 : 2;
      entry.maxSize = 0;
      for (let i = 0; i < sizeLength; i++) {
        entry.maxSize = entry.maxSize * 256 + bytes[cursor + 2 + i];
      }
      entry.readAccess = bytes[cursor + 2 + sizeLength];
      entry.writeAccess = bytes[cursor + 3 + sizeLength];
      if (type === 4) {
        if (!validType4FileId(entry.fileId) || entry.maxSize < 5) {
          malformed = malformed || 'invalid-ndef-file-control';
        } else if (entry.maxSize > 0x7fff) {
          unsupported = unsupported || 'unsupported-file-size';
        } else if (entry.readAccess !== 0) {
          unsupported = unsupported || 'nonfree-read-access';
        }
      } else if (type === 6) {
        unsupported = unsupported || 'extended-file-control';
      }
    } else {
      unsupported = unsupported || 'unsupported-file-control-type';
    }
    cursor = end;
  }
  const standard = cc.files.filter((file) => file.type === 4);
  if (malformed) {
    return {...cc, status: 'malformed', reason: malformed};
  }
  if (standard.length !== 1) {
    unsupported =
      standard.length === 0
        ? unsupported || 'missing-ndef-file-control'
        : 'multiple-ndef-files';
  }
  if (unsupported) {
    return {...cc, status: 'unsupported', reason: unsupported};
  }
  return {...cc, status: 'supported', selectedFile: standard[0]};
}

function ndefEnvelopeIssue(bytes) {
  let cursor = 0;
  let records = 0;
  while (cursor < bytes.length) {
    const header = bytes[cursor++];
    if (
      !!(header & 0x80) !== (records === 0) ||
      (header & 0x20 && header & 0x40) ||
      (header & 7) >= 6 ||
      cursor >= bytes.length
    ) {
      return 'malformed-ndef-message';
    }
    const typeLength = bytes[cursor++];
    const lengthBytes = header & 0x10 ? 1 : 4;
    if (cursor + lengthBytes > bytes.length) {
      return 'malformed-ndef-message';
    }
    let payloadLength = 0;
    for (let i = 0; i < lengthBytes; i++) {
      payloadLength = payloadLength * 256 + bytes[cursor++];
    }
    let idLength = 0;
    if (header & 8) {
      if (cursor >= bytes.length) {
        return 'malformed-ndef-message';
      }
      idLength = bytes[cursor++];
    }
    const tnf = header & 7;
    if (
      (tnf === 0 && (typeLength || payloadLength || idLength)) ||
      (tnf === 5 && typeLength)
    ) {
      return 'malformed-ndef-message';
    }
    cursor += typeLength + idLength + payloadLength;
    if (cursor > bytes.length) {
      return 'malformed-ndef-message';
    }
    if (header & 0x20) {
      return 'unsupported-ndef-chunking';
    }
    records++;
    if (header & 0x40) {
      return cursor === bytes.length ? null : 'malformed-ndef-message';
    }
  }
  return 'malformed-ndef-message';
}

function analyzeType4Ndef({
  bytes = [],
  declaredLength = null,
  complete = false,
} = {}) {
  const ndef = emptyType4Ndef();
  if (
    !isBytes(bytes) ||
    !Number.isInteger(declaredLength) ||
    declaredLength < 0 ||
    declaredLength > 0xffff
  ) {
    return {...ndef, status: 'malformed', reason: 'invalid-ndef-input'};
  }
  ndef.rawBytes = bytes.slice();
  if (
    bytes.length > declaredLength ||
    (complete && bytes.length !== declaredLength)
  ) {
    return {...ndef, status: 'malformed', reason: 'ndef-length-mismatch'};
  }
  if (!complete) {
    return {...ndef, status: 'incomplete', reason: 'incomplete-payload'};
  }
  if (declaredLength === 0) {
    return {...ndef, status: 'empty'};
  }
  const issue = ndefEnvelopeIssue(bytes);
  if (issue) {
    return {
      ...ndef,
      status:
        issue === 'unsupported-ndef-chunking' ? 'unavailable' : 'malformed',
      reason: issue,
    };
  }
  try {
    return {
      ...ndef,
      status: 'decoded',
      records: Ndef.decodeMessage(bytes.slice()),
    };
  } catch (_) {
    return {...ndef, status: 'malformed', reason: 'malformed-ndef-message'};
  }
}

export {emptyType4Cc, emptyType4Ndef, analyzeType4Cc, analyzeType4Ndef};
