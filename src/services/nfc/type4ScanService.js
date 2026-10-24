import {Platform} from 'react-native';
import NfcManager, {NfcError, NfcTech} from 'react-native-nfc-manager';
import {
  TYPE4_AID,
  MAX_CC_BYTES,
  MAX_NDEF_BYTES,
  MAX_COMMANDS,
  MAX_READ_BYTES,
  buildType4SelectApplication,
  buildType4SelectFile,
  buildType4ReadBinary,
  validateType4Command,
  normalizeType4Response,
  boundedDiagnostic,
} from '../../features/type4-ndef/protocol';
import {
  emptyType4Cc,
  emptyType4Ndef,
  analyzeType4Cc,
  analyzeType4Ndef,
} from '../../features/type4-ndef/model';
import {runNfcSession} from './session';

class Cancelled extends Error {}
class FlowStopped extends Error {}

function isCancellation(error) {
  return (
    error instanceof Cancelled ||
    (NfcError?.UserCancel && error instanceof NfcError.UserCancel)
  );
}

function failureFromExchange(kind, entry, message) {
  return {
    kind,
    phase: entry.phase,
    fileId: entry.fileId,
    offset: entry.offset,
    sw1: entry.sw1,
    sw2: entry.sw2,
    responseBytes: entry.responseBytes,
    ...(message === undefined
      ? {
          message: entry.message,
          messageLength: entry.messageLength,
          messageTruncated: entry.messageTruncated,
        }
      : boundedDiagnostic(message)),
  };
}

async function scanType4Ndef({onProgress, shouldContinue = () => true} = {}) {
  const platform = Platform.OS;
  const result = {
    status: 'unavailable',
    cancelled: false,
    platform,
    metadataAcquisition: {
      method: 'none',
      automaticPlatformSelection: platform === 'ios',
      fullRfTrace: false,
    },
    application: {aid: TYPE4_AID, status: 'not-attempted'},
    cc: emptyType4Cc(),
    file: {
      id: null,
      maxSize: null,
      readAccess: null,
      writeAccess: null,
      selected: false,
      nlen: null,
      rawNlen: null,
      chunks: [],
    },
    consistency: {
      status: 'not-checked',
      initialNlen: null,
      finalNlen: null,
      rawFinalNlen: null,
      atomicSnapshot: false,
    },
    scope: {
      kind: 'none',
      plannedBytes: null,
      readBytes: 0,
      verifiedCcBytes: 0,
      verifiedFileBytes: 0,
      commandsSent: 0,
      maxBytes: MAX_NDEF_BYTES,
      maxCcBytes: MAX_CC_BYTES,
      maxCommands: MAX_COMMANDS,
      maxReadBytes: MAX_READ_BYTES,
      limits: [],
    },
    ndef: emptyType4Ndef(),
    transcript: [],
    failure: null,
  };
  let limited = false;
  let ccBytes = [];
  const payload = [];
  const check = () => {
    if (!shouldContinue()) {
      throw new Cancelled();
    }
  };
  const progress = (phase) => {
    check();
    if (typeof onProgress === 'function') {
      onProgress({
        phase,
        commandsSent: result.scope.commandsSent,
        bytesRead: result.scope.readBytes,
        plannedBytes: result.scope.plannedBytes,
      });
    }
    check();
  };
  const stopForLimit = (reason) => {
    limited = true;
    if (!result.scope.limits.includes(reason)) {
      result.scope.limits.push(reason);
    }
    throw new FlowStopped();
  };
  const exchange = async (command, context) => {
    check();
    if (result.scope.commandsSent >= MAX_COMMANDS) {
      stopForLimit('command-limit');
    }
    validateType4Command(command, context);
    progress(context.phase);
    result.scope.commandsSent++;
    const entry = {
      sequence: result.scope.commandsSent,
      phase: context.phase,
      fileId: context.fileId ?? null,
      offset: context.offset ?? null,
      requestedLength: context.length ?? null,
      command: command.slice(),
      data: [],
      sw1: null,
      sw2: null,
      responseBytes: null,
      responseLength: null,
      responseTruncated: false,
      outcome: 'transport-error',
      ...boundedDiagnostic(null),
    };
    let native;
    try {
      check();
      native =
        platform === 'ios'
          ? await NfcManager.sendCommandAPDUIOS(command)
          : await NfcManager.isoDepHandler.transceive(command);
    } catch (error) {
      Object.assign(entry, boundedDiagnostic(error));
      result.transcript.push(entry);
      check();
      if (isCancellation(error)) {
        throw error;
      }
      result.failure = failureFromExchange('transport-error', entry);
      throw new FlowStopped();
    }
    const response = normalizeType4Response(native, platform);
    Object.assign(entry, {
      data: response.data,
      sw1: response.sw1,
      sw2: response.sw2,
      responseBytes: response.responseBytes,
      responseLength: response.responseLength,
      responseTruncated: response.responseTruncated,
    });
    if (!response.valid) {
      entry.outcome = 'malformed-response';
      Object.assign(entry, boundedDiagnostic(response.reason));
    } else if (response.sw1 !== 0x90 || response.sw2 !== 0) {
      entry.outcome = 'status-word';
    } else if (
      context.length !== undefined &&
      response.data.length !== context.length
    ) {
      entry.outcome = 'length-mismatch';
      Object.assign(entry, boundedDiagnostic('read-length-mismatch'));
    } else {
      entry.outcome = 'success';
    }
    result.transcript.push(entry);
    // The attempted exchange is evidence even if its await was cancelled. Never
    // assign its data to verified memory, emit progress or queue another APDU.
    check();
    if (entry.outcome !== 'success') {
      result.failure = failureFromExchange(entry.outcome, entry);
      throw new FlowStopped();
    }
    return entry;
  };
  const read = (context) => exchange(buildType4ReadBinary(context), context);
  const finish = () => {
    if (result.cancelled && result.scope.verifiedFileBytes === 0) {
      return null;
    }
    if (result.failure?.kind === 'invalid-nlen') {
      result.ndef = {...emptyType4Ndef(), reason: 'invalid-nlen'};
    } else if (result.file.nlen !== null) {
      if (payload.length < result.file.nlen) {
        result.ndef = analyzeType4Ndef({
          bytes: payload,
          declaredLength: result.file.nlen,
          complete: false,
        });
      } else if (result.consistency.status === 'equal-length') {
        result.ndef = analyzeType4Ndef({
          bytes: payload,
          declaredLength: result.file.nlen,
          complete: true,
        });
      } else {
        result.ndef = {
          ...emptyType4Ndef(),
          rawBytes: payload.slice(),
          reason: 'length-not-verified',
        };
      }
    }
    if (result.cancelled) {
      result.status = 'partial';
    } else if (result.failure || result.cc.status === 'malformed') {
      result.status =
        result.scope.verifiedFileBytes > 0 ? 'partial' : 'unavailable';
    } else if (limited || result.cc.status === 'unsupported') {
      result.status = 'limited';
    } else if (result.consistency.status === 'equal-length') {
      result.status = 'complete';
    }
    return result;
  };
  try {
    check();
    progress('connecting');
    const session = await runNfcSession({
      technology: [NfcTech.IsoDep],
      silent: true,
      successMessage: null,
      operation: async () => {
        check();
        try {
          try {
            await exchange(buildType4SelectApplication(), {
              phase: 'select-application',
            });
            result.application.status = 'selected';
          } catch (error) {
            if (result.scope.commandsSent > 0) {
              result.application.status =
                result.failure?.kind === 'status-word'
                  ? 'rejected'
                  : 'unavailable';
            }
            throw error;
          }
          check();
          await exchange(buildType4SelectFile('E103'), {
            phase: 'select-cc',
            fileId: 'E103',
          });
          check();
          const header = await read({
            phase: 'read-cc',
            fileId: 'E103',
            fileSize: 7,
            offset: 0,
            length: 7,
          });
          check();
          ccBytes = header.data.slice();
          result.scope.kind = 'cc-only';
          result.scope.verifiedCcBytes = ccBytes.length;
          result.scope.verifiedFileBytes = ccBytes.length;
          result.cc = analyzeType4Cc(ccBytes);
          progress('read-cc');
          if (result.cc.status !== 'incomplete') {
            if (result.cc.status === 'unsupported') {
              stopForLimit(result.cc.reason);
            }
            return;
          }
          const {declaredLength, mle} = result.cc;
          for (let offset = 7; offset < declaredLength; ) {
            check();
            const length = Math.min(
              mle,
              MAX_READ_BYTES,
              declaredLength - offset,
            );
            const entry = await read({
              phase: 'read-cc',
              fileId: 'E103',
              fileSize: declaredLength,
              offset,
              length,
            });
            check();
            ccBytes.push(...entry.data);
            offset += length;
            result.scope.verifiedCcBytes = ccBytes.length;
            result.scope.verifiedFileBytes = ccBytes.length;
            result.cc = analyzeType4Cc(ccBytes);
            progress('read-cc');
          }
          if (result.cc.status !== 'supported') {
            if (result.cc.status === 'unsupported') {
              stopForLimit(result.cc.reason);
            }
            return;
          }
          const selectedFile = result.cc.selectedFile;
          const fileId = selectedFile.fileId;
          Object.assign(result.file, {
            id: fileId,
            maxSize: selectedFile.maxSize,
            readAccess: selectedFile.readAccess,
            writeAccess: selectedFile.writeAccess,
          });
          await exchange(buildType4SelectFile(fileId, selectedFile), {
            phase: 'select-ndef',
            fileId,
            selectedFile,
          });
          check();
          result.file.selected = true;
          result.scope.kind = 'ndef-file';
          const nlenContext = {
            fileId,
            selectedFile,
            fileSize: selectedFile.maxSize,
            offset: 0,
            length: 2,
            planEnd: 2,
          };
          const nlenEntry = await read({...nlenContext, phase: 'read-nlen'});
          check();
          result.file.rawNlen = nlenEntry.data.slice();
          result.file.nlen = nlenEntry.data[0] * 256 + nlenEntry.data[1];
          result.consistency.initialNlen = result.file.nlen;
          result.scope.verifiedFileBytes += 2;
          if (result.file.nlen > selectedFile.maxSize - 2) {
            result.failure = failureFromExchange(
              'invalid-nlen',
              nlenEntry,
              'nlen-exceeds-file-size',
            );
            return;
          }
          const planned = Math.min(result.file.nlen, MAX_NDEF_BYTES);
          result.scope.plannedBytes = planned;
          progress('read-nlen');
          if (planned < result.file.nlen) {
            result.scope.limits.push('ndef-byte-limit');
            limited = true;
          }
          for (let offset = 2; offset < planned + 2; ) {
            check();
            const length = Math.min(mle, MAX_READ_BYTES, planned + 2 - offset);
            const entry = await read({
              phase: 'read-ndef',
              fileId,
              selectedFile,
              fileSize: selectedFile.maxSize,
              offset,
              length,
              planStart: 2,
              planEnd: planned + 2,
            });
            check();
            result.file.chunks.push({offset, bytes: entry.data.slice()});
            payload.push(...entry.data);
            offset += length;
            result.scope.readBytes = payload.length;
            result.scope.verifiedFileBytes += length;
            progress('read-ndef');
          }
          if (planned < result.file.nlen) {
            return;
          }
          // Same selected file, same READ BINARY command family: no reselection.
          let finalEntry;
          try {
            finalEntry = await read({...nlenContext, phase: 'recheck-nlen'});
            check();
          } catch (error) {
            if (!isCancellation(error) && result.failure) {
              result.consistency.status = 'failed';
            }
            throw error;
          }
          const finalNlen = finalEntry.data[0] * 256 + finalEntry.data[1];
          result.consistency.finalNlen = finalNlen;
          result.consistency.rawFinalNlen = finalEntry.data.slice();
          result.consistency.status =
            finalNlen === result.file.nlen ? 'equal-length' : 'length-changed';
          if (finalNlen !== result.file.nlen) {
            result.failure = failureFromExchange(
              'length-changed',
              finalEntry,
              'nlen-changed',
            );
          }
          progress('recheck-nlen');
        } catch (error) {
          if (!(error instanceof FlowStopped)) {
            throw error;
          }
        }
      },
    });
    check();
    if (!session.success) {
      if (isCancellation(session.error)) {
        result.cancelled = true;
      } else if (!result.failure) {
        result.failure = {
          kind: 'transport-error',
          phase: 'connecting',
          fileId: null,
          offset: null,
          sw1: null,
          sw2: null,
          responseBytes: null,
          ...boundedDiagnostic(session.error),
        };
      }
    }
  } catch (error) {
    if (!shouldContinue() || isCancellation(error)) {
      result.cancelled = true;
    } else if (!result.failure) {
      result.failure = {
        kind: 'transport-error',
        phase: 'connecting',
        fileId: null,
        offset: null,
        sw1: null,
        sw2: null,
        responseBytes: null,
        ...boundedDiagnostic(error),
      };
    }
  }
  return finish();
}

export {scanType4Ndef};
