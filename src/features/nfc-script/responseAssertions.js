const MAX_ASSERTION_BYTES = 4096;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function parseAssertionHex(value) {
  if (typeof value !== 'string') {
    throw new Error('assertion bytes must be literal hex pairs');
  }
  const text = value.trim();
  if (text === '') {
    return [];
  }
  if (!/^[\da-f]{2}(?:\s+[\da-f]{2})*$/i.test(text)) {
    throw new Error('assertion bytes must be literal hex pairs');
  }
  return text.split(/\s+/).map((byte) => parseInt(byte, 16));
}

function validateResponseAssertion(step, tech, hasResponse) {
  const errors = [];
  if (!hasResponse) {
    errors.push('no previous response to assert');
  }
  if (!['data', 'raw'].includes(step.source)) {
    errors.push('invalid assertion source');
  }
  const validLength =
    Number.isInteger(step.length) &&
    step.length >= 0 &&
    step.length <= MAX_ASSERTION_BYTES;
  if (!validLength) {
    errors.push('assertion length must be 0–4096');
  }
  let expectedBytes = null;
  if (hasOwn(step, 'expectedHex')) {
    try {
      expectedBytes = parseAssertionHex(step.expectedHex);
      if (validLength && expectedBytes.length !== step.length) {
        errors.push('assertion bytes must match the expected length');
      }
    } catch (error) {
      errors.push(error.message);
    }
  }
  const hasSw = hasOwn(step, 'expectedSw');
  const validSw =
    hasSw &&
    typeof step.expectedSw === 'string' &&
    step.expectedSw.length === 4 &&
    /^[\da-f]{4}$/i.test(step.expectedSw);
  if (hasSw) {
    if (!validSw) {
      errors.push('assertion status must be four hex digits');
    }
    if (tech !== 'IsoDep') {
      errors.push('assertion status requires IsoDep');
    }
  }
  if (tech === 'IsoDep' && step.source === 'raw') {
    if (validLength && step.length < 2) {
      errors.push('ISO-DEP raw assertion length must include SW1/SW2');
    }
    if (
      expectedBytes &&
      expectedBytes.length >= 2 &&
      validSw &&
      expectedBytes[expectedBytes.length - 2] * 256 +
        expectedBytes[expectedBytes.length - 1] !==
        parseInt(step.expectedSw, 16)
    ) {
      errors.push('assertion bytes conflict with expected status');
    }
  }
  return errors;
}

function bytesToHex(bytes) {
  return bytes
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function evaluateResponseAssertion(step, response) {
  if (!response) {
    throw new Error('No previous response to assert');
  }
  const actualBytes = response[step.source];
  const expectedBytes = hasOwn(step, 'expectedHex')
    ? parseAssertionHex(step.expectedHex)
    : null;
  const expectedSw = hasOwn(step, 'expectedSw')
    ? step.expectedSw.toUpperCase()
    : null;
  const actualSw = Number.isInteger(response.sw)
    ? response.sw.toString(16).padStart(4, '0').toUpperCase()
    : null;
  const checks = {
    length: actualBytes.length === step.length,
    bytes:
      expectedBytes === null
        ? null
        : actualBytes.length === expectedBytes.length &&
          actualBytes.every((byte, index) => byte === expectedBytes[index]),
    sw: expectedSw === null ? null : response.sw === parseInt(expectedSw, 16),
  };
  const failure = !checks.length
    ? 'length'
    : checks.sw === false
    ? 'status'
    : checks.bytes === false
    ? 'bytes'
    : null;
  return {
    source: step.source,
    expectedLength: step.length,
    actualLength: actualBytes.length,
    expectedHex: expectedBytes === null ? null : bytesToHex(expectedBytes),
    actualHex: bytesToHex(actualBytes.slice(0, MAX_ASSERTION_BYTES)),
    actualHexTruncated: actualBytes.length > MAX_ASSERTION_BYTES,
    expectedSw,
    actualSw,
    checks,
    passed: failure === null,
    failure,
  };
}

function assertionFailureMessage(assertion) {
  switch (assertion.failure) {
    case 'length':
      return `Response length mismatch: expected ${assertion.expectedLength}, received ${assertion.actualLength}`;
    case 'status':
      return `Response status mismatch: expected ${assertion.expectedSw}, received ${assertion.actualSw}`;
    case 'bytes':
      return 'Response bytes do not match expected bytes';
    default:
      return null;
  }
}

export {
  assertionFailureMessage,
  evaluateResponseAssertion,
  parseAssertionHex,
  validateResponseAssertion,
};
