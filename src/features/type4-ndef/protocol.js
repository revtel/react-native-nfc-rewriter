const TYPE4_AID = 'D2760000850101';
const MAX_CC_BYTES = 1024;
const MAX_NDEF_BYTES = 8192;
const MAX_COMMANDS = 1024;
const MAX_READ_BYTES = 240;
const MAX_RESPONSE_DATA = 256;
const MAX_DIAGNOSTIC_CHARS = 4096;
const FORBIDDEN_FILE_IDS = ['0000', 'E102', 'E103', '3F00', '3FFF', 'FFFF'];

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function isBytes(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    if (!isByte(value[i])) {
      return false;
    }
  }
  return true;
}

function validType4FileId(fileId) {
  return (
    typeof fileId === 'string' &&
    /^[0-9A-F]{4}$/.test(fileId) &&
    !FORBIDDEN_FILE_IDS.includes(fileId)
  );
}

function eligibleType4File(file) {
  return (
    file?.type === 4 &&
    file.length === 6 &&
    validType4FileId(file.fileId) &&
    Number.isInteger(file.maxSize) &&
    file.maxSize >= 5 &&
    file.maxSize <= 0x7fff &&
    file.readAccess === 0
  );
}

function buildType4SelectApplication() {
  return [0, 0xa4, 4, 0, 7, 0xd2, 0x76, 0, 0, 0x85, 1, 1, 0];
}

function buildType4SelectFile(fileId, selectedFile = null) {
  if (
    fileId !== 'E103' &&
    (!eligibleType4File(selectedFile) || selectedFile.fileId !== fileId)
  ) {
    throw new Error('Unvalidated Type4 file selection');
  }
  return [
    0,
    0xa4,
    0,
    0x0c,
    2,
    parseInt(fileId.slice(0, 2), 16),
    parseInt(fileId.slice(2), 16),
  ];
}

function buildType4ReadBinary({
  fileId,
  selectedFile = null,
  fileSize,
  offset,
  length,
  planStart = 0,
  planEnd = fileSize,
}) {
  if (
    fileId !== 'E103' &&
    (!eligibleType4File(selectedFile) ||
      fileId !== selectedFile.fileId ||
      fileSize !== selectedFile.maxSize)
  ) {
    throw new Error('Unvalidated Type4 read file');
  }
  if (
    !Number.isInteger(fileSize) ||
    fileSize < 1 ||
    fileSize > (fileId === 'E103' ? MAX_CC_BYTES : 0x7fff) ||
    !Number.isInteger(planStart) ||
    !Number.isInteger(planEnd) ||
    planStart < 0 ||
    planEnd > fileSize ||
    planEnd < planStart ||
    !Number.isInteger(offset) ||
    offset < planStart ||
    offset > 0x7fff ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > MAX_READ_BYTES ||
    offset + length > planEnd
  ) {
    throw new Error('Out-of-bounds Type4 READ BINARY');
  }
  return [0, 0xb0, Math.floor(offset / 256), offset % 256, length];
}

function validateType4Command(command, context) {
  let expected;
  if (context.phase === 'select-application') {
    expected = buildType4SelectApplication();
  } else if (context.phase === 'select-cc' || context.phase === 'select-ndef') {
    expected = buildType4SelectFile(context.fileId, context.selectedFile);
  } else if (
    ['read-cc', 'read-nlen', 'read-ndef', 'recheck-nlen'].includes(
      context.phase,
    )
  ) {
    expected = buildType4ReadBinary(context);
  } else {
    throw new Error('Unsupported Type4 command phase');
  }
  if (
    !isBytes(command) ||
    command.length !== expected.length ||
    command.some((byte, index) => byte !== expected[index])
  ) {
    throw new Error('Unsupported Type4 APDU');
  }
  return true;
}

function boundedDiagnostic(error) {
  if (error === null || error === undefined) {
    return {message: null, messageLength: null, messageTruncated: false};
  }
  const text =
    typeof error === 'string' ? error : String(error.message ?? error);
  return {
    message: text.slice(0, MAX_DIAGNOSTIC_CHARS),
    messageLength: text.length,
    messageTruncated: text.length > MAX_DIAGNOSTIC_CHARS,
  };
}

function bytePrefix(bytes, maximum) {
  const prefix = [];
  if (Array.isArray(bytes)) {
    for (let i = 0; i < bytes.length && i < maximum && isByte(bytes[i]); i++) {
      prefix.push(bytes[i]);
    }
  }
  return prefix;
}

function normalizeType4Response(nativeResponse, platform) {
  let source = null;
  let sw1 = null;
  let sw2 = null;
  let responseLength = null;
  let shapeValid = true;
  let dataLength = 0;
  if (platform === 'android' && Array.isArray(nativeResponse)) {
    responseLength = nativeResponse.length;
    if (nativeResponse.length >= 2) {
      source = nativeResponse;
      dataLength = nativeResponse.length - 2;
      sw1 = isByte(nativeResponse[dataLength])
        ? nativeResponse[dataLength]
        : null;
      sw2 = isByte(nativeResponse[dataLength + 1])
        ? nativeResponse[dataLength + 1]
        : null;
      shapeValid = isBytes(nativeResponse);
    } else {
      // Too short to distinguish data from status. Preserve a bounded raw prefix.
      return {
        data: [],
        sw1,
        sw2,
        responseBytes: bytePrefix(nativeResponse, MAX_RESPONSE_DATA),
        responseLength,
        responseTruncated: false,
        valid: false,
        reason: 'missing-status-word',
      };
    }
  } else if (
    platform === 'ios' &&
    nativeResponse &&
    !Array.isArray(nativeResponse) &&
    typeof nativeResponse === 'object'
  ) {
    source = Array.isArray(nativeResponse.response)
      ? nativeResponse.response
      : null;
    dataLength = source?.length ?? 0;
    sw1 = isByte(nativeResponse.sw1) ? nativeResponse.sw1 : null;
    sw2 = isByte(nativeResponse.sw2) ? nativeResponse.sw2 : null;
    responseLength =
      source && sw1 !== null && sw2 !== null ? dataLength + 2 : null;
    shapeValid = isBytes(source);
  } else {
    shapeValid = false;
  }
  const data = bytePrefix(source, Math.min(dataLength, MAX_RESPONSE_DATA));
  const oversized = dataLength > MAX_RESPONSE_DATA;
  const responseTruncated =
    !!source && (data.length < dataLength || sw1 === null || sw2 === null);
  const responseBytes = source
    ? [...data, ...(sw1 === null ? [] : [sw1]), ...(sw2 === null ? [] : [sw2])]
    : null;
  const valid =
    shapeValid && sw1 !== null && sw2 !== null && !responseTruncated;
  return {
    data,
    sw1,
    sw2,
    responseBytes,
    responseLength,
    responseTruncated,
    valid,
    reason: oversized
      ? 'response-data-limit'
      : valid
      ? null
      : 'invalid-native-response',
  };
}

export {
  TYPE4_AID,
  MAX_CC_BYTES,
  MAX_NDEF_BYTES,
  MAX_COMMANDS,
  MAX_READ_BYTES,
  MAX_RESPONSE_DATA,
  MAX_DIAGNOSTIC_CHARS,
  isByte,
  isBytes,
  validType4FileId,
  eligibleType4File,
  buildType4SelectApplication,
  buildType4SelectFile,
  buildType4ReadBinary,
  validateType4Command,
  boundedDiagnostic,
  normalizeType4Response,
};
