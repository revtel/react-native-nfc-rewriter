import {parseExpression, resolveTemplate} from './expressions';
import {MAX_EXECUTED_STEPS, validateScript} from './model';

function normalizeResponse(tech, raw) {
  if (
    !Array.isArray(raw) ||
    !raw.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    throw new Error('Invalid transceive response');
  }
  if (tech === 'IsoDep') {
    if (raw.length < 2) {
      throw new Error('ISO-DEP response is missing SW1/SW2');
    }
    return {
      raw: [...raw],
      data: raw.slice(0, -2),
      sw: raw[raw.length - 2] * 256 + raw[raw.length - 1],
    };
  }
  return {raw: [...raw], data: [...raw]};
}

function captureResponse(response, step) {
  if (!response) {
    throw new Error('No previous response to capture');
  }
  const source = response[step.source];
  const length =
    step.format === 'bytes' ? step.length : step.format === 'u8' ? 1 : 2;
  if (step.offset + length > source.length) {
    throw new Error('Capture exceeds response length');
  }
  const bytes = source.slice(step.offset, step.offset + length);
  if (step.format === 'bytes') {
    return bytes;
  }
  if (step.format === 'u8') {
    return bytes[0];
  }
  return step.format === 'u16be'
    ? bytes[0] * 256 + bytes[1]
    : bytes[1] * 256 + bytes[0];
}

function compare(left, operator, right) {
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    default:
      throw new Error('Invalid comparison');
  }
}

const defaultDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeScript(
  script,
  {transceive, delay = defaultDelay, maxSteps = MAX_EXECUTED_STEPS} = {},
) {
  const errors = validateScript(script);
  const trace = [];
  const variables = Object.create(null);
  if (errors.length > 0) {
    return {success: false, trace, variables, error: errors.join('; ')};
  }
  if (typeof transceive !== 'function') {
    return {success: false, trace, variables, error: 'Missing NFC transport'};
  }
  let lastResponse = null;
  let executed = 0;
  let stopped = null;

  async function runSteps(steps, path) {
    for (let idx = 0; idx < steps.length; idx++) {
      if (stopped) {
        break;
      }
      const step = steps[idx];
      const location = [...path, idx].join('/');
      const entry = {location, type: step.type};
      trace.push(entry);
      try {
        executed++;
        if (executed > maxSteps) {
          throw new Error(`Execution exceeded ${maxSteps} steps`);
        }
        switch (step.type) {
          case 'transceive': {
            const bytes = resolveTemplate(step.template, variables);
            entry.command = [...bytes];
            lastResponse = normalizeResponse(
              script.tech,
              await transceive(bytes),
            );
            entry.response = lastResponse;
            if (script.tech === 'IsoDep') {
              variables.sw = lastResponse.sw;
            }
            break;
          }
          case 'delay':
            entry.ms = step.ms;
            await delay(step.ms);
            break;
          case 'set':
            variables[step.name] = parseExpression(
              step.expression,
              variables,
            ).value;
            entry.variable = {name: step.name, value: variables[step.name]};
            break;
          case 'capture':
            variables[step.name] = captureResponse(lastResponse, step);
            entry.variable = {name: step.name, value: variables[step.name]};
            break;
          case 'if': {
            const left = parseExpression(step.left, variables).value;
            const right = parseExpression(step.right, variables).value;
            const matched = compare(left, step.operator, right);
            entry.branch = matched ? 'then' : 'else';
            entry.comparison = {left, operator: step.operator, right};
            await runSteps(matched ? step.then : step.else, [
              ...path,
              idx,
              entry.branch,
            ]);
            break;
          }
          case 'repeat': {
            const count = parseExpression(step.count, variables).value;
            if (count < 0 || count > step.maxIterations) {
              throw new Error(
                `Repeat count ${count} exceeds maximum ${step.maxIterations}`,
              );
            }
            entry.count = count;
            const previousIndex = variables.index;
            for (
              let iteration = 0;
              iteration < count && !stopped;
              iteration++
            ) {
              variables.index = iteration;
              await runSteps(step.steps, [...path, idx, `repeat:${iteration}`]);
            }
            if (previousIndex === undefined) {
              delete variables.index;
            } else {
              variables.index = previousIndex;
            }
            break;
          }
          case 'stop':
            entry.outcome = step.outcome;
            entry.message = step.message;
            stopped = {
              success: step.outcome === 'success',
              userMessage: Boolean(step.message),
              error:
                step.outcome === 'failure'
                  ? step.message || 'Script stopped'
                  : null,
            };
            break;
          default:
            throw new Error('Unknown step type');
        }
      } catch (error) {
        entry.error = error?.message || String(error);
        stopped = {success: false, error: `${location}: ${entry.error}`};
      }
    }
  }

  await runSteps(script.steps, []);
  return {
    success: stopped ? stopped.success : true,
    trace,
    variables: {...variables},
    error: stopped?.error || null,
    ...(stopped?.userMessage ? {userMessage: true} : {}),
  };
}

export {captureResponse, executeScript, normalizeResponse};
