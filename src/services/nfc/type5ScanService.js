import {Platform} from 'react-native';
import NfcManager, {NfcError, NfcTech} from 'react-native-nfc-manager';
import {
  MAX_BLOCKS,
  MAX_BYTES,
  isBytes,
  normalizeType5Uid,
  buildType5Frame,
  emptySystemInfo,
  parseType5SystemInfo,
  parseType5Response,
} from '../../features/type5-memory/protocol';
import {analyzeType5Memory} from '../../features/type5-memory/model';
import {runNfcSession} from './session';

class ScanCancelled extends Error {}
class MalformedNativeResponse extends Error {}

function isCancellation(error) {
  return (
    error instanceof ScanCancelled ||
    (NfcError?.UserCancel && error instanceof NfcError.UserCancel)
  );
}

function createType5ScanPlan(systemInfo) {
  const {geometryTrusted, blockCount, blockSize} = systemInfo;
  if (
    !geometryTrusted ||
    !Number.isInteger(blockCount) ||
    blockCount < 1 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > 32
  ) {
    return {
      kind: 'block-zero-preview',
      reportedBlocks: null,
      blockSize: null,
      plannedBlocks: 1,
      readBlocks: 0,
      readBytes: 0,
      maxBlocks: MAX_BLOCKS,
      maxBytes: MAX_BYTES,
      limits: ['unknown-geometry'],
    };
  }
  const plannedBlocks = Math.min(
    blockCount,
    MAX_BLOCKS,
    Math.floor(MAX_BYTES / blockSize),
  );
  const limits = [];
  if (blockCount > MAX_BLOCKS) {
    limits.push('standard-address-limit');
  }
  if (blockCount * blockSize > MAX_BYTES) {
    limits.push('byte-limit');
  }
  return {
    kind: plannedBlocks === blockCount ? 'reported-range' : 'bounded-range',
    reportedBlocks: blockCount,
    blockSize,
    plannedBlocks,
    readBlocks: 0,
    readBytes: 0,
    maxBlocks: MAX_BLOCKS,
    maxBytes: MAX_BYTES,
    limits,
  };
}

function makeFailure(
  kind,
  phase,
  {
    blockAddress = null,
    responseFlags = null,
    tagErrorCode = null,
    rawResponse = null,
    message = null,
  } = {},
) {
  return {
    kind,
    phase,
    blockAddress,
    responseFlags,
    tagErrorCode,
    rawResponse,
    message,
  };
}

function nativeMessage(error) {
  return error?.message ?? String(error);
}

async function sendRequest(frame, platform) {
  if (platform === 'ios') {
    const response = await NfcManager.iso15693HandlerIOS.sendRequest({
      flags: frame[0],
      commandCode: frame[1],
      data: frame.slice(2),
    });
    if (
      !Array.isArray(response) ||
      response.length !== 2 ||
      !isBytes([response[0]]) ||
      !isBytes(response[1])
    ) {
      throw new MalformedNativeResponse('Invalid iOS ISO15693 response tuple');
    }
    return [response[0], ...response[1]];
  }
  return NfcManager.nfcVHandler.transceive(frame);
}

async function scanType5Memory({onProgress, shouldContinue = () => true} = {}) {
  const platform = Platform.OS;
  const result = {
    status: 'unidentified',
    cancelled: false,
    platform,
    metadataRead: {
      method: 'getTag',
      mayReadNdef: platform === 'ios',
      includedInRawReadBounds: false,
    },
    tag: normalizeType5Uid(null, platform),
    systemInfo: emptySystemInfo(),
    scope: {
      kind: 'none',
      reportedBlocks: null,
      blockSize: null,
      plannedBlocks: 0,
      readBlocks: 0,
      readBytes: 0,
      maxBlocks: MAX_BLOCKS,
      maxBytes: MAX_BYTES,
      limits: [],
    },
    blocks: [],
    failure: null,
  };
  const check = () => {
    if (!shouldContinue()) {
      throw new ScanCancelled();
    }
  };
  const progress = (phase) => {
    check();
    if (typeof onProgress === 'function') {
      onProgress({
        phase,
        blocksRead: result.blocks.length,
        plannedBlocks:
          result.scope.kind === 'none' ? null : result.scope.plannedBlocks,
      });
    }
    check();
  };
  const finish = () => {
    if (result.cancelled && result.blocks.length === 0) {
      return null;
    }
    if (result.blocks.length === 0) {
      result.status = 'unidentified';
    } else if (result.failure || result.cancelled) {
      result.status = 'partial';
    } else {
      result.status =
        result.scope.kind === 'reported-range' ? 'complete' : 'limited';
    }
    return {
      ...result,
      ...analyzeType5Memory({
        blocks: result.blocks,
        blockSize: result.scope.blockSize,
        reportedBlocks: result.scope.reportedBlocks,
        geometryTrusted: result.systemInfo.geometryTrusted,
      }),
    };
  };
  try {
    check();
    progress('connecting');
    check();
    const session = await runNfcSession({
      technology: [NfcTech.NfcV],
      silent: true,
      successMessage: null,
      operation: async () => {
        // requestTechnology is awaited by the wrapper before entering operation.
        check();
        let tag;
        try {
          check();
          tag = await NfcManager.getTag();
          check();
        } catch (error) {
          check();
          if (isCancellation(error)) {
            throw error;
          }
          result.failure = makeFailure('transport-error', 'identity', {
            message: nativeMessage(error),
          });
          return;
        }
        result.tag = normalizeType5Uid(tag?.id, platform);
        if (!result.tag.uidWireLE) {
          result.failure = makeFailure('uid-unusable', 'identity', {
            message: 'uid-unusable',
          });
          return;
        }
        const uid = result.tag.uidWireLE;
        progress('system-info');
        let rawInfo;
        try {
          check();
          rawInfo = await sendRequest(buildType5Frame(0x2b, uid), platform);
          check();
          result.systemInfo = parseType5SystemInfo(rawInfo);
        } catch (error) {
          check();
          if (isCancellation(error)) {
            throw error;
          }
          result.systemInfo = {
            ...emptySystemInfo(),
            status:
              error instanceof MalformedNativeResponse
                ? 'malformed'
                : 'unavailable',
            reason: nativeMessage(error),
          };
        }
        // Optional parsing errors must never hide complete conflicting identity.
        const returnedUid = result.systemInfo.uidWireLE;
        if (returnedUid && returnedUid.some((byte, i) => byte !== uid[i])) {
          result.failure = makeFailure('identity-mismatch', 'system-info', {
            rawResponse: result.systemInfo.rawResponse,
            responseFlags: rawInfo?.[0] ?? null,
            message: 'system-info-uid-mismatch',
          });
          return;
        }
        result.scope = createType5ScanPlan(result.systemInfo);
        for (let address = 0; address < result.scope.plannedBlocks; address++) {
          progress('reading');
          let raw;
          try {
            check();
            raw = await sendRequest(
              buildType5Frame(0x20, uid, [address]),
              platform,
            );
            check();
          } catch (error) {
            check();
            if (isCancellation(error)) {
              throw error;
            }
            result.failure = makeFailure(
              error instanceof MalformedNativeResponse
                ? 'malformed-response'
                : 'transport-error',
              'read-block',
              {blockAddress: address, message: nativeMessage(error)},
            );
            return;
          }
          const response = parseType5Response(raw);
          if (response.kind) {
            result.failure = makeFailure(response.kind, 'read-block', {
              blockAddress: address,
              responseFlags: response.responseFlags,
              tagErrorCode: response.tagErrorCode,
              rawResponse: response.rawResponse,
              message: response.reason,
            });
            return;
          }
          const bytes = response.payload;
          if (result.scope.blockSize === null) {
            if (bytes.length < 1 || bytes.length > 32) {
              result.failure = makeFailure('malformed-response', 'read-block', {
                blockAddress: address,
                responseFlags: response.responseFlags,
                rawResponse: response.rawResponse,
                message: 'invalid-observed-block-size',
              });
              return;
            }
            result.scope.blockSize = bytes.length;
          }
          if (bytes.length !== result.scope.blockSize) {
            result.failure = makeFailure('block-size-mismatch', 'read-block', {
              blockAddress: address,
              responseFlags: response.responseFlags,
              rawResponse: response.rawResponse,
              message: 'block-size-mismatch',
            });
            return;
          }
          result.blocks.push({address, bytes: bytes.slice()});
          result.scope.readBlocks = result.blocks.length;
          result.scope.readBytes += bytes.length;
          progress('reading');
        }
      },
    });
    check();
    if (!session.success) {
      if (isCancellation(session.error)) {
        result.cancelled = true;
      } else if (!result.failure) {
        result.failure = makeFailure(
          'transport-error',
          result.blocks.length ? 'read-block' : 'identity',
          {message: nativeMessage(session.error)},
        );
      }
    }
  } catch (error) {
    if (!shouldContinue() || isCancellation(error)) {
      result.cancelled = true;
    } else if (!result.failure) {
      result.failure = makeFailure(
        'transport-error',
        result.blocks.length ? 'read-block' : 'identity',
        {message: nativeMessage(error)},
      );
    }
  }
  return finish();
}

export {scanType5Memory, createType5ScanPlan};
