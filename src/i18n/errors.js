import catalog from './catalog.json';
import {translateText as tr} from './index';

// Classify the stable, untranslated diagnostic text at the display boundary.
// Internal messages and protocol control flow retain their original values.
const diagnostics = Object.entries(catalog)
  .filter(([key]) => key.startsWith('errors.'))
  .map(([code, [source]]) => {
    const names = [];
    const pieces = source.split(/(\{\{\w+\}\})/).map((piece) => {
      const variable = /^\{\{(\w+)\}\}$/.exec(piece);
      if (variable) {
        names.push(variable[1]);
        return '(.+)';
      }
      return piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return {
      code,
      source,
      names,
      pattern: new RegExp('^' + pieces.join('') + '$'),
    };
  });

function classifyError(message) {
  for (const diagnostic of diagnostics) {
    const match = diagnostic.pattern.exec(message);
    if (match) {
      return {
        code: diagnostic.code,
        source: diagnostic.source,
        values: Object.fromEntries(
          diagnostic.names.map((name, index) => [name, match[index + 1]]),
        ),
      };
    }
  }
  return null;
}

function translateError(message) {
  const text = String(message ?? '');
  if (text.includes('; ')) {
    return text.split('; ').map(translateError).join('; ');
  }
  const prefix =
    /^(Step (\d+)|\d+(?:\/(?:\d+|then|else|repeat:\d+))*): (.*)$/s.exec(text);
  if (prefix) {
    return (
      (prefix[2]
        ? tr('Step {{number}}:', {number: prefix[2]})
        : `${prefix[1]}:`) +
      ' ' +
      translateError(prefix[3])
    );
  }
  const diagnostic = classifyError(text);
  return diagnostic
    ? tr(diagnostic.source, diagnostic.values)
    : tr('The operation failed. Technical details: {{details}}', {
        details: text,
      });
}

export {classifyError, translateError};
