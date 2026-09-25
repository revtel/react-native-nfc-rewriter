const TLV_NAMES = {
  0x01: 'Lock Control',
  0x02: 'Memory Control',
  0x03: 'NDEF Message',
  0xfd: 'Proprietary',
};

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function entryPosition(index) {
  const absoluteByteOffset = 16 + index;
  return {
    byteOffset: absoluteByteOffset,
    page: Math.floor(absoluteByteOffset / 4),
    pageByteOffset: absoluteByteOffset % 4,
  };
}

function parseType2Tlvs(bytes, {isComplete = true} = {}) {
  if (!Array.isArray(bytes) || !bytes.every(isByte)) {
    return {status: 'malformed', entries: [], error: 'Invalid byte data'};
  }

  const entries = [];
  let index = 0;
  while (index < bytes.length) {
    const type = bytes[index];
    if (type === 0x00) {
      index++;
      continue;
    }

    const position = entryPosition(index);
    if (type === 0xfe) {
      entries.push({type, name: 'Terminator', ...position, status: 'valid'});
      return {status: 'complete', entries};
    }
    if (type === 0xff) {
      entries.push({type, name: 'Invalid TLV', ...position, status: 'malformed'});
      return {status: 'malformed', entries, error: 'Invalid TLV type'};
    }

    const name = TLV_NAMES[type] || 'Unknown TLV';
    if (index + 1 >= bytes.length) {
      entries.push({type, name, ...position, status: 'truncated'});
      return {
        status: isComplete ? 'malformed' : 'incomplete',
        entries,
        error: 'Missing TLV length',
      };
    }

    let length = bytes[index + 1];
    let headerLength = 2;
    if (length === 0xff) {
      if (index + 3 >= bytes.length) {
        entries.push({type, name, ...position, status: 'truncated'});
        return {
          status: isComplete ? 'malformed' : 'incomplete',
          entries,
          error: 'Missing extended TLV length',
        };
      }
      length = bytes[index + 2] * 256 + bytes[index + 3];
      headerLength = 4;
    }

    const dataStart = index + headerLength;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) {
      entries.push({type, name, ...position, length, status: 'truncated'});
      return {
        status: isComplete ? 'malformed' : 'incomplete',
        entries,
        error: 'TLV extends beyond available bytes',
      };
    }

    entries.push({
      type,
      name,
      ...position,
      length,
      status: 'valid',
    });
    index = dataEnd;
  }

  return {status: isComplete ? 'complete' : 'incomplete', entries};
}

export {parseType2Tlvs};
