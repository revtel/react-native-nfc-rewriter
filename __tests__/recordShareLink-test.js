import {
  createRecordShareLink,
  createRecordShareContent,
} from '../src/features/records/shareLink';
import {parseShareDeepLink} from '../src/features/home/deepLink';

test.each(['Ndef', 'NfcA', 'NfcV', 'IsoDep'])('record link preserves %s payload, Unicode and URI delimiters', (tech) => {
  const record = {
    name: '繁體 日本語 🏷️ & + # % ?',
    payload: {tech, value: 'a&b+c#d%25?z=1', bytes: [0, 127, 255]},
  };
  const url = createRecordShareLink(record);
  expect(url).toBe(`com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(JSON.stringify(record))}`);
  expect(parseShareDeepLink(url).record).toEqual(record);
});

test('a large script round-trips without truncation or execution', () => {
  const record = {
    name: 'Long flow',
    payload: {
      kind: 'nfc-script',
      version: 1,
      tech: 'IsoDep',
      steps: [{type: 'stop', outcome: 'success', message: '長 & #'.repeat(4000)}],
    },
  };
  expect(parseShareDeepLink(createRecordShareLink(record))).toEqual({
    name: 'NfcScriptEditor',
    params: {savedRecord: record},
    record,
  });
});

test('legacy record envelopes are serialized without new schema restrictions', () => {
  const record = {payload: {tech: 'Ndef', value: 'legacy record without a name'}};
  expect(parseShareDeepLink(createRecordShareLink(record)).record).toEqual(record);
});

test('iOS and Android use one complete supported share field each', () => {
  const record = {name: 'Example', payload: {tech: 'Ndef'}};
  const url = createRecordShareLink(record);
  expect(createRecordShareContent(record, 'android')).toEqual({title: 'My NFC Record', message: url});
  expect(createRecordShareContent(record, 'ios')).toEqual({title: 'My NFC Record', url});
});
