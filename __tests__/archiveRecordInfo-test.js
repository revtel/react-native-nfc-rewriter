import {classifyLibraryRecord, summarizeLibrary} from '../src/features/record-library/recordInfo';
import {createArchive, parseArchive} from '../src/features/record-library/archive';
import golden from './fixtures/record-library/mixed-v1.json';

const record = (payload, name = 'Example') => ({name, payload});
const info = (payload) => classifyLibraryRecord(record(payload));

test.each([
  {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'text'},
  {tech: 'Ndef', tnf: 1, rtd: 'T', value: ''},
  {tech: 'Ndef', tnf: 1, rtd: 'U', value: {value: 'example.com', prefix: 'https://'}},
  {tech: 'Ndef', tnf: 1, rtd: 'U', value: {value: 'someone@example.com', scheme: 'mailto:'}},
  {tech: 'Ndef', tnf: 2, mimeType: 'application/vnd.wfa.wsc', value: {ssid: 'local', networkKey: 'synthetic'}},
  {tech: 'Ndef', tnf: 2, mimeType: 'text/vcard', value: {name: 'A', tel: '', email: '', org: ''}},
])('supported NDEF editor shapes are openable without modifying their value: %p', (payload) => {
  expect(info(payload)).toEqual({supported: true, kind: 'Ndef', name: 'Example'});
});

test.each(['NfcA', 'NfcV', 'IsoDep'])('legacy %s command arrays stay openable while callback-dependent parameter templates stay inert', (tech) => {
  const value = [{type: 'command', payload: [0, 127, 255]}, {type: 'delay', payload: 100}];
  expect(info({tech, value})).toMatchObject({supported: true, kind: tech});
  expect(info({tech, value: []})).toMatchObject({supported: true});
  expect(classifyLibraryRecord({name: 'legacy', parameters: [{name: 'Password', length: 4}], payload: {tech, value}})).toMatchObject({supported: false});
});

test.each([
  {tech: 'Ndef', value: 'not enough format evidence'},
  {tech: 'Ndef', tnf: 1, rtd: 'T', value: {}},
  {tech: 'Ndef', tnf: 1, rtd: 'U', value: 'writer expects an object'},
  {tech: 'Ndef', tnf: 1, rtd: 'U', value: {value: 'x', scheme: 'unknown:'}},
  {tech: 'Ndef', tnf: 2, mimeType: 'text/vcard', value: {name: []}},
  {tech: 'Ndef', tnf: 2, mimeType: 'application/vnd.wfa.wsc', value: {ssid: 7, networkKey: 'x'}},
  {tech: 'NfcA', value: 'not a command list'},
  {tech: 'NfcA', value: [null]},
  {tech: 'NfcV', value: [{type: 'command', payload: [256]}]},
  {tech: 'IsoDep', value: [{type: 'unknown', payload: []}]},
  {tech: 'NfcA', kind: 'future', value: []},
  {tech: 'Unknown', value: []},
])('known malformed or unknown payloads are inert, not discarded: %p', (payload) => {
  expect(info(payload)).toEqual({supported: false, kind: 'unsupported', name: 'Example'});
  expect(parseArchive(createArchive([record(payload)])).records).toEqual([record(payload)]);
});

test.each([null, 1, 'text', [], {}, {payload: {tech: 'NfcA', value: []}}, {name: {}, payload: {tech: 'NfcA', value: []}}])('opaque JSON entries never gain an open action: %p', (value) => {
  expect(classifyLibraryRecord(value)).toEqual({supported: false, kind: 'unsupported', name: null});
});

test('versioned scripts use the existing validator but are never executed', () => {
  const valid = {kind: 'nfc-script', version: 1, tech: 'NfcA', steps: [{type: 'stop', outcome: 'success', message: 'preview'}]};
  expect(info(valid)).toMatchObject({supported: true, kind: 'script'});
  expect(info({...valid, version: 2})).toMatchObject({supported: false});
  expect(info({...valid, steps: [{type: 'stop'}]})).toMatchObject({supported: false});
  expect(info({...valid, steps: Array(121).fill({type: 'delay', ms: 100})})).toMatchObject({supported: false});
  let steps = [];
  for (let index = 0; index < 8; index++) steps = [{type: 'repeat', count: '1', maxIterations: 1, steps}];
  expect(info({...valid, steps})).toMatchObject({supported: false});
});

test('summary reports unsupported counts and original global indices without filtering library data', () => {
  const records = [null, golden.records[0], golden.records[2], golden.records[6]];
  const before = JSON.stringify(records);
  const summary = summarizeLibrary(records);
  expect(summary).toMatchObject({totalCount: 4, supportedCount: 2, unsupportedCount: 2,
    counts: {Ndef: 1, NfcA: 1, unsupported: 2}});
  expect(summary.entries.map(({index}) => index)).toEqual([0, 1, 2, 3]);
  expect(summary.entries[3]).toMatchObject({kind: 'unsupported', name: 'Future script'});
  expect(JSON.stringify(records)).toBe(before);
});
