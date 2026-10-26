import {
  analyzeType4Cc,
  analyzeType4Ndef,
} from '../src/features/type4-ndef/model';

const APP = [0, 0xa4, 4, 0, 7, 0xd2, 0x76, 0, 0, 0x85, 1, 1, 0];
const SELECT_CC = [0, 0xa4, 0, 0x0c, 2, 0xe1, 3];
const SELECT_NDEF = [0, 0xa4, 0, 0x0c, 2, 0xe1, 4];
const simplePayload = [
  0x91, 1, 4, 0x54, 2, 0x65, 0x6e, 0x78, 0x51, 1, 4, 0x54, 2, 0x65, 0x6e, 0x79,
];
const nlenBytes = (length) => [Math.floor(length / 256), length % 256];

// Presentation-only fixture data, analyzed by production pure functions; never RF evidence.
function createType4Fixture(variant = 'complete', platform = 'ios') {
  let payload = simplePayload;
  let mle = 240;
  let maxSize = 256;
  if (variant === 'partial') {
    payload = [0xc5, 0, 0, 0, 1, 44, ...Array(300).fill(0x78)];
    maxSize = 512;
  }
  if (variant === 'long') {
    payload = [0xc5, 0, 0, 0, 0x1f, 0xfa, ...Array(8186).fill(0x78)];
    mle = 15;
    maxSize = 0x7fff;
  }
  const ccBytes = [
    0,
    15,
    0x20,
    ...nlenBytes(mle),
    0,
    0x34,
    4,
    6,
    0xe1,
    4,
    ...nlenBytes(maxSize),
    variant === 'restricted' ? 0x80 : 0,
    0xff,
  ];
  const rawNlen = nlenBytes(payload.length);
  const result = {
    status: 'complete',
    cancelled: false,
    platform,
    metadataAcquisition: {
      method: 'none',
      automaticPlatformSelection: platform === 'ios',
      fullRfTrace: false,
    },
    application: {aid: 'D2760000850101', status: 'selected'},
    cc: analyzeType4Cc(ccBytes),
    file: {
      id: 'E104',
      maxSize,
      readAccess: 0,
      writeAccess: 0xff,
      selected: true,
      nlen: payload.length,
      rawNlen,
      chunks: [],
    },
    consistency: {
      status: 'equal-length',
      initialNlen: payload.length,
      finalNlen: payload.length,
      rawFinalNlen: rawNlen.slice(),
      atomicSnapshot: false,
    },
    scope: {
      kind: 'ndef-file',
      plannedBytes: payload.length,
      readBytes: 0,
      verifiedCcBytes: 15,
      verifiedFileBytes: 17,
      commandsSent: 0,
      maxBytes: 8192,
      maxCcBytes: 1024,
      maxCommands: 1024,
      maxReadBytes: 240,
      limits: [],
    },
    ndef: analyzeType4Ndef({
      bytes: payload,
      declaredLength: payload.length,
      complete: true,
    }),
    transcript: [],
    failure: null,
  };
  function exchange(
    phase,
    command,
    data = [],
    {
      fileId = null,
      offset = null,
      requestedLength = null,
      sw1 = 0x90,
      sw2 = 0,
      outcome = 'success',
      message = null,
      messageLength = null,
      messageTruncated = false,
    } = {},
  ) {
    result.transcript.push({
      sequence: result.transcript.length + 1,
      phase,
      fileId,
      offset,
      requestedLength,
      command,
      data,
      sw1,
      sw2,
      responseBytes: sw1 == null ? null : [...data, sw1, sw2],
      responseLength: sw1 == null ? null : data.length + 2,
      responseTruncated: false,
      outcome,
      message,
      messageLength,
      messageTruncated,
    });
  }
  function read(phase, fileId, offset, bytes, options = {}) {
    exchange(
      phase,
      [0, 0xb0, Math.floor(offset / 256), offset % 256, bytes.length],
      bytes,
      {fileId, offset, requestedLength: bytes.length, ...options},
    );
  }
  exchange('select-application', APP);
  exchange('select-cc', SELECT_CC, [], {fileId: 'E103'});
  read('read-cc', 'E103', 0, ccBytes.slice(0, 7));
  read('read-cc', 'E103', 7, ccBytes.slice(7));
  if (variant === 'restricted') {
    result.status = 'limited';
    result.file = {
      id: null,
      maxSize: null,
      readAccess: null,
      writeAccess: null,
      selected: false,
      nlen: null,
      rawNlen: null,
      chunks: [],
    };
    result.consistency = {
      status: 'not-checked',
      initialNlen: null,
      finalNlen: null,
      rawFinalNlen: null,
      atomicSnapshot: false,
    };
    result.scope = {
      ...result.scope,
      kind: 'cc-only',
      plannedBytes: null,
      verifiedFileBytes: 15,
    };
    result.ndef = {
      status: 'unavailable',
      rawBytes: [],
      records: [],
      reason: null,
    };
  } else {
    exchange('select-ndef', SELECT_NDEF, [], {fileId: 'E104'});
    read('read-nlen', 'E104', 0, rawNlen);
    for (let start = 0; start < payload.length; start += mle) {
      const chunk = payload.slice(start, start + mle);
      if (variant === 'partial' && start > 0) {
        const failedCommand = [
          0,
          0xb0,
          Math.floor((start + 2) / 256),
          (start + 2) % 256,
          chunk.length,
        ];
        exchange('read-ndef', failedCommand, [], {
          fileId: 'E104',
          offset: start + 2,
          requestedLength: chunk.length,
          sw1: 0x69,
          sw2: 0x82,
          outcome: 'status-word',
        });
        result.status = 'partial';
        result.failure = {
          kind: 'status-word',
          phase: 'read-ndef',
          fileId: 'E104',
          offset: start + 2,
          sw1: 0x69,
          sw2: 0x82,
          responseBytes: [0x69, 0x82],
          message: null,
          messageLength: null,
          messageTruncated: false,
        };
        break;
      }
      read('read-ndef', 'E104', start + 2, chunk);
      result.file.chunks.push({offset: start + 2, bytes: chunk});
      result.scope.readBytes += chunk.length;
      result.scope.verifiedFileBytes += chunk.length;
    }
    if (variant === 'partial') {
      result.consistency = {
        ...result.consistency,
        status: 'not-checked',
        finalNlen: null,
        rawFinalNlen: null,
      };
      result.ndef = analyzeType4Ndef({
        bytes: result.file.chunks.flatMap((chunk) => chunk.bytes),
        declaredLength: payload.length,
        complete: false,
      });
    } else {
      const finalNlen =
        variant === 'changed' ? payload.length + 1 : payload.length;
      read('recheck-nlen', 'E104', 0, nlenBytes(finalNlen));
      if (variant === 'changed') {
        result.status = 'partial';
        result.consistency = {
          ...result.consistency,
          status: 'length-changed',
          finalNlen,
          rawFinalNlen: nlenBytes(finalNlen),
        };
        result.ndef = {
          status: 'unavailable',
          rawBytes: payload.slice(),
          records: [],
          reason: 'length-changed',
        };
        result.failure = {
          kind: 'length-changed',
          phase: 'recheck-nlen',
          fileId: 'E104',
          offset: 0,
          sw1: 0x90,
          sw2: 0,
          responseBytes: [...nlenBytes(finalNlen), 0x90, 0],
          message: null,
          messageLength: null,
          messageTruncated: false,
        };
      }
    }
  }
  if (variant === 'unavailable') {
    result.status = 'unavailable';
    result.application.status = 'rejected';
    result.cc = analyzeType4Cc([]);
    result.file = {
      id: null,
      maxSize: null,
      readAccess: null,
      writeAccess: null,
      selected: false,
      nlen: null,
      rawNlen: null,
      chunks: [],
    };
    result.consistency = {
      status: 'not-checked',
      initialNlen: null,
      finalNlen: null,
      rawFinalNlen: null,
      atomicSnapshot: false,
    };
    result.scope = {
      ...result.scope,
      kind: 'none',
      plannedBytes: null,
      readBytes: 0,
      verifiedCcBytes: 0,
      verifiedFileBytes: 0,
    };
    result.ndef = {
      status: 'unavailable',
      rawBytes: [],
      records: [],
      reason: null,
    };
    result.transcript = [];
    exchange('select-application', APP, [], {
      sw1: 0x6a,
      sw2: 0x82,
      outcome: 'status-word',
    });
    result.failure = {
      kind: 'status-word',
      phase: 'select-application',
      fileId: null,
      offset: null,
      sw1: 0x6a,
      sw2: 0x82,
      responseBytes: [0x6a, 0x82],
      message: null,
      messageLength: null,
      messageTruncated: false,
    };
  }
  result.scope.commandsSent = result.transcript.length;
  return result;
}

export {createType4Fixture};
