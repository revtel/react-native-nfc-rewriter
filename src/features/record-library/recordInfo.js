import {MAX_NODES, SCRIPT_KIND, SCRIPT_VERSION, validateScript} from '../nfc-script/model';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytes = (value) => Array.isArray(value) && value.every((byte, index) =>
  Object.prototype.hasOwnProperty.call(value, index) && Number.isInteger(byte) && byte >= 0 && byte <= 255);
const strings = (value, fields) => fields.every((field) =>
  value[field] === undefined || typeof value[field] === 'string');

function supportedNdef(payload) {
  if (payload.tnf === 1 && payload.rtd === 'T') return typeof payload.value === 'string';
  if (payload.tnf === 1 && payload.rtd === 'U') {
    const value = payload.value;
    if (!object(value) || typeof value.value !== 'string') return false;
    return (value.prefix === undefined || ['https://', 'http://', '---'].includes(value.prefix)) &&
      (value.scheme === undefined || ['tel:', 'sms:', 'mailto:'].includes(value.scheme));
  }
  if (payload.tnf === 2 && payload.mimeType === 'application/vnd.wfa.wsc') {
    return object(payload.value) && typeof payload.value.ssid === 'string' &&
      typeof payload.value.networkKey === 'string';
  }
  if (payload.tnf === 2 && payload.mimeType === 'text/vcard') {
    return object(payload.value) && typeof payload.value.name === 'string' &&
      strings(payload.value, ['org', 'tel', 'email']);
  }
  return false;
}

function supportedTransceive(record) {
  const commands = record.payload.value;
  if (!Array.isArray(commands) || !commands.every((command) => object(command) && (
    (command.type === 'command' && bytes(command.payload)) ||
    (command.type === 'delay' && Number.isFinite(command.payload) && command.payload >= 0)
  ))) return false;
  // Parameter templates require callbacks that a JSON archive cannot carry.
  if (record.parameters !== undefined &&
    (!Array.isArray(record.parameters) || record.parameters.length > 0)) return false;
  return true;
}

// Limit the traversal before calling the existing detailed validator, whose
// error reporting deliberately walks the entire editable script.
function boundedScript(script) {
  if (!Array.isArray(script.steps)) return false;
  const stack = [{steps: script.steps, depth: 0}];
  let count = 0;
  while (stack.length) {
    const {steps, depth} = stack.pop();
    if (depth > 6) return false;
    for (const step of steps) {
      count += 1;
      if (count > MAX_NODES || !object(step)) return false;
      if (step.type === 'if') {
        if (!Array.isArray(step.then) || !Array.isArray(step.else)) return false;
        stack.push({steps: step.then, depth: depth + 1}, {steps: step.else, depth: depth + 1});
      } else if (step.type === 'repeat') {
        if (!Array.isArray(step.steps)) return false;
        stack.push({steps: step.steps, depth: depth + 1});
      }
    }
  }
  return true;
}

function classifyLibraryRecord(record) {
  const name = object(record) && typeof record.name === 'string' ? record.name : null;
  const unsupported = {supported: false, kind: 'unsupported', name};
  if (!object(record) || name === null || !object(record.payload)) return unsupported;
  const payload = record.payload;
  if (payload.kind === SCRIPT_KIND) {
    if (payload.version !== SCRIPT_VERSION || !boundedScript(payload)) return unsupported;
    try {
      return validateScript(payload).length === 0
        ? {supported: true, kind: 'script', name} : unsupported;
    } catch (_) { return unsupported; }
  }
  if (payload.kind !== undefined) return unsupported;
  const supported = payload.tech === 'Ndef' ? supportedNdef(payload)
    : ['NfcA', 'NfcV', 'IsoDep'].includes(payload.tech) && supportedTransceive(record);
  return supported ? {supported: true, kind: payload.tech, name} : unsupported;
}

function summarizeLibrary(records) {
  const counts = {Ndef: 0, NfcA: 0, NfcV: 0, IsoDep: 0, script: 0, unsupported: 0};
  const entries = records.map((record, index) => {
    const info = classifyLibraryRecord(record);
    counts[info.kind] += 1;
    return {index, ...info};
  });
  return {
    totalCount: records.length,
    supportedCount: records.length - counts.unsupported,
    unsupportedCount: counts.unsupported,
    counts,
    entries,
  };
}

export {classifyLibraryRecord, summarizeLibrary};
