import {
  parseTemplateTokens,
  serializeTemplateTokens,
  variablesAfterStep,
} from '../src/features/nfc-script/editorHelpers';

test('editor variable types follow earlier steps and ISO-DEP status', () => {
  const afterCommand = variablesAfterStep({}, {type: 'transceive'}, 'IsoDep');
  expect(afterCommand).toEqual({sw: 'number'});
  const afterSet = variablesAfterStep(
    afterCommand,
    {type: 'set', name: 'page'},
    'IsoDep',
  );
  expect(afterSet).toEqual({sw: 'number', page: 'number'});
  const afterCapture = variablesAfterStep(
    afterSet,
    {type: 'capture', name: 'payload', format: 'bytes'},
    'IsoDep',
  );
  expect(afterCapture).toEqual({sw: 'number', page: 'number', payload: 'bytes'});
  expect(afterSet).not.toHaveProperty('payload');
  expect(variablesAfterStep({}, {type: 'transceive'}, 'NfcA')).toEqual({});
});

test('text and builder modes use one command template representation', () => {
  const tokens = parseTemplateTokens('30 04 ${page + index * 4:u8}');
  expect(tokens).toEqual(['30', '04', '${page + index * 4:u8}']);
  expect(serializeTemplateTokens([...tokens, 'AF'])).toBe(
    '30 04 ${page + index * 4:u8} AF',
  );
  expect(parseTemplateTokens('')).toEqual([]);
  expect(() => parseTemplateTokens('30 0')).toThrow('Invalid command byte');
});
