/* eslint-disable no-bitwise -- ISO15693 flags and fields are bit masks. */
const MAX_BLOCKS = 256;
const MAX_BYTES = 8192;
const REQUEST_FLAGS = 0x22;

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function isBytes(value) {
  return Array.isArray(value) && value.every(isByte);
}

function normalizeType5Uid(raw, platform) {
  const tag = {
    platformTagIdRaw: raw ?? null,
    uidDisplayBE: null,
    uidWireLE: null,
    uidSource: null,
  };
  let bytes;
  if (typeof raw === 'string' && /^[\da-f]{16}$/i.test(raw)) {
    bytes = raw.match(/../g).map((byte) => parseInt(byte, 16));
  } else if (isBytes(raw) && raw.length === 8) {
    bytes = raw.slice();
  } else {
    return tag;
  }
  if (platform === 'ios') {
    if (bytes[0] !== 0xe0) {
      return tag;
    }
  } else if (platform === 'android') {
    if ((bytes[0] === 0xe0) === (bytes[7] === 0xe0)) {
      return tag;
    }
    if (bytes[7] === 0xe0) {
      bytes.reverse();
    }
  } else {
    return tag;
  }
  tag.uidDisplayBE = bytes
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  tag.uidWireLE = bytes.slice().reverse();
  tag.uidSource = 'platform';
  return tag;
}

function buildType5Frame(
  commandCode,
  uidWireLE,
  parameters = [],
  flags = REQUEST_FLAGS,
) {
  if (
    flags !== REQUEST_FLAGS ||
    !isBytes(uidWireLE) ||
    uidWireLE.length !== 8 ||
    uidWireLE[7] !== 0xe0
  ) {
    throw new Error('Invalid addressed ISO15693 request');
  }
  if (
    !isBytes(parameters) ||
    !(
      (commandCode === 0x2b && parameters.length === 0) ||
      (commandCode === 0x20 && parameters.length === 1)
    )
  ) {
    throw new Error('Unsupported ISO15693 command or address');
  }
  return [flags, commandCode, ...uidWireLE, ...parameters];
}

function parseType5Response(rawResponse) {
  const evidence = {
    rawResponse: isBytes(rawResponse) ? rawResponse.slice() : null,
    responseFlags: null,
    tagErrorCode: null,
    payload: [],
    kind: null,
    reason: null,
  };
  if (!isBytes(rawResponse) || rawResponse.length === 0) {
    return {
      ...evidence,
      kind: 'malformed-response',
      reason: 'invalid-response',
    };
  }
  evidence.responseFlags = rawResponse[0];
  if (rawResponse[0] & 1) {
    if (rawResponse.length !== 2) {
      return {
        ...evidence,
        kind: 'malformed-response',
        reason: 'invalid-error-response',
      };
    }
    return {
      ...evidence,
      kind: 'tag-error',
      tagErrorCode: rawResponse[1],
      reason: 'tag-error',
    };
  }
  // All response flags except Error are reserved for these standard commands.
  if (rawResponse[0] !== 0) {
    return {
      ...evidence,
      kind: 'malformed-response',
      reason: 'unsupported-response-flags',
    };
  }
  return {...evidence, payload: rawResponse.slice(1)};
}

function emptySystemInfo() {
  return {
    status: 'unavailable',
    rawResponse: null,
    informationFlags: null,
    uidWireLE: null,
    dsfid: null,
    afi: null,
    icReference: null,
    blockCount: null,
    blockSize: null,
    geometryTrusted: false,
    reason: null,
  };
}

function parseType5SystemInfo(rawResponse) {
  const info = {
    ...emptySystemInfo(),
    rawResponse: isBytes(rawResponse) ? rawResponse.slice() : null,
  };
  const response = parseType5Response(rawResponse);
  if (response.kind) {
    return {
      ...info,
      status: response.kind === 'tag-error' ? 'unavailable' : 'malformed',
      reason: response.reason,
    };
  }
  const payload = response.payload;
  if (payload.length > 0) {
    info.informationFlags = payload[0];
  }
  if (payload.length < 9) {
    return {
      ...info,
      status: 'malformed',
      reason: 'truncated-system-info-header',
    };
  }
  // Identity is preserved before *any* optional-field validation.
  info.uidWireLE = payload.slice(1, 9);
  const flags = payload[0];
  if (flags & 0xf0) {
    return {
      ...info,
      status: 'unsupported',
      reason: 'unsupported-information-flags',
    };
  }
  let cursor = 9;
  const expectedLength =
    9 +
    (flags & 1 ? 1 : 0) +
    (flags & 2 ? 1 : 0) +
    (flags & 4 ? 2 : 0) +
    (flags & 8 ? 1 : 0);
  if (payload.length !== expectedLength) {
    return {
      ...info,
      status: 'malformed',
      reason:
        payload.length < expectedLength
          ? 'truncated-system-info'
          : 'extra-system-info-bytes',
    };
  }
  if (flags & 1) {
    info.dsfid = payload[cursor++];
  }
  if (flags & 2) {
    info.afi = payload[cursor++];
  }
  if (flags & 4) {
    const countByte = payload[cursor++];
    const sizeByte = payload[cursor++];
    if (sizeByte & 0xe0) {
      return {...info, status: 'malformed', reason: 'reserved-block-size-bits'};
    }
    info.blockCount = countByte + 1;
    info.blockSize = (sizeByte & 0x1f) + 1;
    info.geometryTrusted = true;
  }
  if (flags & 8) {
    info.icReference = payload[cursor];
  }
  return {...info, status: 'valid'};
}

export {
  MAX_BLOCKS,
  MAX_BYTES,
  REQUEST_FLAGS,
  isByte,
  isBytes,
  normalizeType5Uid,
  buildType5Frame,
  parseType5Response,
  emptySystemInfo,
  parseType5SystemInfo,
};
