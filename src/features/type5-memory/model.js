/* eslint-disable no-bitwise -- CC and NDEF headers contain protocol bit fields. */
import Ndef from 'react-native-nfc-manager/ndef-lib';
import {isBytes} from './protocol';

function emptyCc() {
  return {
    status: 'unavailable',
    rawBytes: [],
    magic: null,
    length: null,
    mappingVersion: null,
    readAccess: null,
    writeAccess: null,
    features: null,
    mlen: null,
    dataStart: null,
    dataLength: null,
    dataEnd: null,
    reason: null,
  };
}

function emptyNdef() {
  return {
    status: 'unavailable',
    tlvs: [],
    rawBytes: null,
    records: [],
    reason: null,
  };
}

function parseCc(bytes, physicalBytes) {
  const cc = emptyCc();
  if (bytes.length === 0) {
    return cc;
  }
  cc.magic = bytes[0];
  cc.rawBytes = bytes.slice(0, 4);
  if (cc.magic !== 0xe1 && cc.magic !== 0xe2) {
    return {...cc, status: 'not-type5', reason: 'unrecognized-cc-magic'};
  }
  if (bytes.length < 4) {
    return {...cc, status: 'incomplete', reason: 'incomplete-cc-header'};
  }
  cc.length = bytes[2] === 0 ? 8 : 4;
  cc.rawBytes = bytes.slice(0, cc.length);
  cc.mappingVersion = {major: (bytes[1] >> 6) & 3, minor: (bytes[1] >> 4) & 3};
  cc.readAccess = (bytes[1] >> 2) & 3;
  cc.writeAccess = bytes[1] & 3;
  cc.features = bytes[3];
  if (bytes.length < cc.length) {
    return {...cc, status: 'incomplete', reason: 'incomplete-cc-header'};
  }
  cc.mlen = cc.length === 4 ? bytes[2] : bytes[6] * 256 + bytes[7];
  cc.dataStart = cc.length;
  cc.dataLength = cc.mlen * 8;
  cc.dataEnd = cc.dataStart + cc.dataLength;
  if (cc.length === 8 && (bytes[4] !== 0 || bytes[5] !== 0)) {
    return {...cc, status: 'malformed', reason: 'reserved-cc-bytes'};
  }
  if (
    cc.mlen === 0 ||
    cc.readAccess === 1 ||
    cc.readAccess === 3 ||
    cc.writeAccess === 1
  ) {
    return {...cc, status: 'malformed', reason: 'invalid-cc-fields'};
  }
  if (physicalBytes !== null && cc.dataEnd > physicalBytes) {
    return {
      ...cc,
      status: 'inconsistent',
      reason: 'cc-exceeds-reported-memory',
    };
  }
  if (cc.mappingVersion.major !== 1 || cc.mappingVersion.minor !== 0) {
    return {
      ...cc,
      status: 'unsupported',
      reason: 'unsupported-mapping-version',
    };
  }
  if (cc.readAccess !== 0) {
    return {...cc, status: 'unsupported', reason: 'proprietary-read-access'};
  }
  // b0 multiple-block, b2 MLEN encoding, b3 lock-block and b4 special frame
  // are recognized metadata. Reserved feature bits are not interpreted.
  if (cc.features & ~0x1d) {
    return {...cc, status: 'unsupported', reason: 'unsupported-cc-features'};
  }
  return {...cc, status: 'supported'};
}

// The library decoder is permissive about truncated records. Validate the full
// message envelope first so it never turns a short/contradictory payload into records.
function ndefEnvelopeIssue(bytes) {
  let cursor = 0;
  let records = 0;
  while (cursor < bytes.length) {
    const header = bytes[cursor++];
    if (
      !!(header & 0x80) !== (records === 0) ||
      (header & 0x20 && header & 0x40) ||
      (header & 7) >= 6
    ) {
      return 'malformed-ndef-message';
    }
    if (cursor >= bytes.length) {
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
    if (header & 0x08) {
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

function parseTlvs(bytes, cc) {
  const ndef = {...emptyNdef(), status: 'absent'};
  const availableEnd = Math.min(bytes.length, cc.dataEnd);
  let cursor = cc.dataStart;
  let found = false;
  const fail = (status, reason) => ({...ndef, status, reason});
  while (cursor < availableEnd) {
    const offset = cursor;
    const type = bytes[cursor++];
    if (type === 0 || type === 0xfe) {
      ndef.tlvs.push({
        type,
        offset,
        declaredLength: 0,
        bytes: [],
        complete: true,
      });
      if (type === 0xfe) {
        return ndef;
      }
      continue;
    }
    const entry = {
      type,
      offset,
      declaredLength: null,
      bytes: [],
      complete: false,
    };
    ndef.tlvs.push(entry);
    if (cursor >= cc.dataEnd) {
      return fail('malformed', 'tlv-header-exceeds-data-area');
    }
    if (cursor >= availableEnd) {
      return fail('incomplete', 'incomplete-tlv-header');
    }
    let length = bytes[cursor++];
    if (length === 0xff) {
      if (cursor + 2 > cc.dataEnd) {
        return fail('malformed', 'tlv-header-exceeds-data-area');
      }
      if (cursor + 2 > availableEnd) {
        return fail('incomplete', 'incomplete-tlv-header');
      }
      length = bytes[cursor++] * 256 + bytes[cursor++];
    }
    entry.declaredLength = length;
    entry.bytes = bytes.slice(cursor, Math.min(cursor + length, availableEnd));
    if (cursor + length > cc.dataEnd) {
      return fail('malformed', 'tlv-exceeds-data-area');
    }
    if (cursor + length > availableEnd) {
      return fail('incomplete', 'incomplete-tlv-payload');
    }
    entry.complete = true;
    cursor += length;
    if (![3, 0xfd].includes(type)) {
      return fail('unavailable', 'unsupported-tlv-type');
    }
    if (type === 3) {
      if (found) {
        return fail('malformed', 'multiple-ndef-tlvs');
      }
      found = true;
      ndef.rawBytes = entry.bytes.slice();
      if (length === 0) {
        ndef.status = 'empty';
      } else {
        const issue = ndefEnvelopeIssue(entry.bytes);
        if (issue) {
          return fail(
            issue === 'unsupported-ndef-chunking' ? 'unavailable' : 'malformed',
            issue,
          );
        }
        try {
          ndef.records = Ndef.decodeMessage(entry.bytes.slice());
          ndef.status = 'decoded';
        } catch (_) {
          return fail('malformed', 'malformed-ndef-message');
        }
      }
    }
  }
  // A complete NDEF message is useful even when later memory was not read.
  return found || availableEnd === cc.dataEnd
    ? ndef
    : fail('incomplete', 'incomplete-data-area');
}

function analyzeType5Memory({
  blocks = [],
  blockSize = null,
  reportedBlocks = null,
  geometryTrusted = false,
} = {}) {
  const bytes = [];
  if (Number.isInteger(blockSize) && blockSize >= 1 && blockSize <= 32) {
    for (let address = 0; address < blocks.length; address++) {
      const block = blocks[address];
      if (
        block.address !== address ||
        !isBytes(block.bytes) ||
        block.bytes.length !== blockSize
      ) {
        break;
      }
      bytes.push(...block.bytes);
    }
  }
  const physicalBytes =
    geometryTrusted &&
    Number.isInteger(reportedBlocks) &&
    reportedBlocks > 0 &&
    Number.isInteger(blockSize)
      ? reportedBlocks * blockSize
      : null;
  const cc = parseCc(bytes, physicalBytes);
  const ndef =
    cc.status === 'supported'
      ? parseTlvs(bytes, cc)
      : {...emptyNdef(), reason: 'cc-not-supported'};
  return {cc, ndef};
}

export {analyzeType5Memory};
