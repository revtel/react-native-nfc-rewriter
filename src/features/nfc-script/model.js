import {
  IDENTIFIER,
  expressionNames,
  parseTemplate,
  templateNames,
} from './expressions';
import {validateResponseAssertion} from './responseAssertions';

const SCRIPT_KIND = 'nfc-script';
const SCRIPT_VERSION = 1;
const MAX_NODES = 120;
const MAX_DEPTH = 6;
const MAX_REPEAT = 64;
const MAX_EXECUTED_STEPS = 500;
const TECHS = ['NfcA', 'IsoDep'];
const FORMATS = ['bytes', 'u8', 'u16be', 'u16le'];
const OPERATORS = ['==', '!=', '<', '<=', '>', '>='];
const RESERVED_NAMES = ['index', 'sw', '__proto__', 'prototype', 'constructor'];

function newScript(tech = 'NfcA') {
  return {kind: SCRIPT_KIND, version: SCRIPT_VERSION, tech, steps: []};
}

function makeStep(type) {
  switch (type) {
    case 'transceive':
      return {type, template: ''};
    case 'assert-response':
      return {type, source: 'data', length: 0};
    case 'delay':
      return {type, ms: 100};
    case 'set':
      return {type, name: 'value', expression: '0'};
    case 'capture':
      return {type, name: 'value', source: 'data', offset: 0, format: 'u8'};
    case 'if':
      return {type, left: '0', operator: '==', right: '0', then: [], else: []};
    case 'repeat':
      return {type, count: '1', maxIterations: 16, steps: []};
    case 'stop':
      return {type, outcome: 'success', message: ''};
    default:
      throw new Error(`Unknown step type: ${type}`);
  }
}

function updateStepList(steps, path, updater) {
  if (path.length === 0) {
    return updater(steps);
  }
  const [{index, branch}, ...rest] = path;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= steps.length ||
    !['then', 'else', 'steps'].includes(branch)
  ) {
    throw new Error('Invalid step path');
  }
  const step = steps[index];
  if (!Array.isArray(step[branch])) {
    throw new Error('Invalid branch path');
  }
  return steps.map((current, idx) =>
    idx === index
      ? {...current, [branch]: updateStepList(current[branch], rest, updater)}
      : current,
  );
}

function validateScript(script) {
  const errors = [];
  if (!script || typeof script !== 'object' || Array.isArray(script)) {
    return ['Script must be an object'];
  }
  if (script.kind !== SCRIPT_KIND) {
    errors.push('Unknown script kind');
  }
  if (script.version !== SCRIPT_VERSION) {
    errors.push('Unsupported script version');
  }
  if (!TECHS.includes(script.tech)) {
    errors.push('Unsupported NFC technology');
  }
  if (!Array.isArray(script.steps)) {
    return [...errors, 'Steps must be an array'];
  }
  let nodes = 0;
  const declared = new Set();

  function checkExpression(value, label, allowed) {
    try {
      const names = expressionNames(value);
      names.forEach((name) => {
        if (!allowed.has(name)) {
          errors.push(`${label}: unknown variable ${name}`);
        }
      });
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  function walk(steps, depth, available, hasResponse = false) {
    if (depth > MAX_DEPTH) {
      errors.push('Script nesting is too deep');
    }
    for (const [idx, step] of steps.entries()) {
      nodes++;
      const label = `Step ${idx + 1}`;
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        errors.push(`${label}: invalid step`);
        continue;
      }
      switch (step.type) {
        case 'transceive':
          try {
            parseTemplate(step.template);
            templateNames(step.template).forEach((name) => {
              if (!available.has(name)) {
                errors.push(`${label}: unknown variable ${name}`);
              }
            });
          } catch (error) {
            errors.push(`${label}: ${error.message}`);
          }
          available.add('__response');
          hasResponse = true;
          if (script.tech === 'IsoDep') {
            available.add('sw');
          }
          break;
        case 'assert-response':
          validateResponseAssertion(step, script.tech, hasResponse).forEach(
            (error) => errors.push(`${label}: ${error}`),
          );
          break;
        case 'delay':
          if (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 5000) {
            errors.push(`${label}: delay must be 0–5000 ms`);
          }
          break;
        case 'set':
          if (
            !IDENTIFIER.test(step.name || '') ||
            RESERVED_NAMES.includes(step.name)
          ) {
            errors.push(`${label}: invalid variable name`);
          }
          checkExpression(step.expression, label, available);
          available.add(step.name);
          declared.add(step.name);
          break;
        case 'capture':
          if (
            !IDENTIFIER.test(step.name || '') ||
            RESERVED_NAMES.includes(step.name)
          ) {
            errors.push(`${label}: invalid variable name`);
          }
          if (!available.has('__response')) {
            errors.push(`${label}: no previous response to capture`);
          }
          if (!['data', 'raw'].includes(step.source)) {
            errors.push(`${label}: invalid response source`);
          }
          if (
            !Number.isInteger(step.offset) ||
            step.offset < 0 ||
            step.offset > 65535
          ) {
            errors.push(`${label}: invalid capture offset`);
          }
          if (!FORMATS.includes(step.format)) {
            errors.push(`${label}: invalid capture format`);
          }
          if (
            step.format === 'bytes' &&
            (!Number.isInteger(step.length) ||
              step.length < 1 ||
              step.length > 4096)
          ) {
            errors.push(`${label}: invalid capture length`);
          }
          available.add(step.name);
          declared.add(step.name);
          break;
        case 'if': {
          checkExpression(step.left, label, available);
          checkExpression(step.right, label, available);
          if (!OPERATORS.includes(step.operator)) {
            errors.push(`${label}: invalid comparison`);
          }
          if (!Array.isArray(step.then) || !Array.isArray(step.else)) {
            errors.push(`${label}: missing branch`);
          } else {
            walk(step.then, depth + 1, new Set(available), hasResponse);
            walk(step.else, depth + 1, new Set(available), hasResponse);
          }
          break;
        }
        case 'repeat': {
          checkExpression(step.count, label, available);
          if (
            !Number.isInteger(step.maxIterations) ||
            step.maxIterations < 1 ||
            step.maxIterations > MAX_REPEAT
          ) {
            errors.push(`${label}: maximum must be 1–${MAX_REPEAT}`);
          }
          if (!Array.isArray(step.steps)) {
            errors.push(`${label}: missing repeat body`);
          } else {
            walk(
              step.steps,
              depth + 1,
              new Set([...available, 'index']),
              hasResponse,
            );
          }
          break;
        }
        case 'stop':
          if (!['success', 'failure'].includes(step.outcome)) {
            errors.push(`${label}: invalid stop outcome`);
          }
          if (typeof step.message !== 'string' || step.message.length > 200) {
            errors.push(`${label}: invalid stop message`);
          }
          break;
        default:
          errors.push(`${label}: unknown step type`);
      }
    }
  }

  walk(script.steps, 0, declared);
  if (nodes > MAX_NODES) {
    errors.push(`Script exceeds ${MAX_NODES} nodes`);
  }
  return errors;
}

export {
  FORMATS,
  MAX_EXECUTED_STEPS,
  MAX_REPEAT,
  OPERATORS,
  SCRIPT_KIND,
  SCRIPT_VERSION,
  TECHS,
  makeStep,
  newScript,
  updateStepList,
  validateScript,
};
