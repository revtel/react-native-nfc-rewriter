import {IDENTIFIER, parseTemplate} from './expressions';

const RESERVED_NAMES = ['index', 'sw', '__proto__', 'prototype', 'constructor'];

function variablesAfterStep(available, step, tech) {
  const next = {...available};
  if (step?.type === 'transceive' && tech === 'IsoDep') {
    next.sw = 'number';
  }
  if (
    (step?.type === 'set' || step?.type === 'capture') &&
    IDENTIFIER.test(step.name || '') &&
    !RESERVED_NAMES.includes(step.name)
  ) {
    if (step.type === 'set') {
      next[step.name] = 'number';
    } else if (['bytes', 'u8', 'u16be', 'u16le'].includes(step.format)) {
      next[step.name] = step.format === 'bytes' ? 'bytes' : 'number';
    }
  }
  return next;
}

function parseTemplateTokens(template) {
  if (!template || !template.trim()) {
    return [];
  }
  return parseTemplate(template).map((part) =>
    'literal' in part
      ? part.literal.toString(16).padStart(2, '0').toUpperCase()
      : '${' + part.expression + ':' + part.format + '}',
  );
}

function serializeTemplateTokens(tokens) {
  return tokens.join(' ');
}

export {parseTemplateTokens, serializeTemplateTokens, variablesAfterStep};
