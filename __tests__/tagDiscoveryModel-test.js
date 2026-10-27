import {createTagDiscovery} from '../src/features/tag-discovery/model';
import {getTechList} from '../src/Utils/getTechList';

test.each([
  ['mifare', 'NfcA', 'nfc-a'],
  ['IsoDep', 'IsoDep', 'iso-dep'],
  ['iso15693', 'NfcV', 'iso15693'],
  ['felica', 'NfcF', 'felica'],
])('normalizes iOS %s without changing its original metadata', (tech, normalized, capability) => {
  const tag = Object.freeze({tech, id: 'ABCDEF', extra: {original: true}});
  const result = createTagDiscovery(tag, 'ios');
  expect(result.technologies).toEqual([normalized]);
  expect(result.capabilities).toContain(capability);
  expect(tag.tech).toBe(tech);
  expect(result.limitations).toContain('ios-detection-allowlists');
});

test('retains ID and IDm independently, all records, and original technical values', () => {
  const records = [{tnf: 1, type: [84], payload: [0]}, {tnf: 2, type: [1], payload: [2]}];
  const tag = {tech: 'felica', idm: '0102030405060708', ndefMessage: records};
  const result = createTagDiscovery(tag, 'ios');
  expect(result.identifiers).toEqual([{kind: 'idm', value: tag.idm}]);
  expect(result.ndef).toEqual({status: 'available', records});
  expect(result.ndef.records).not.toBe(records);
  expect(tag).not.toHaveProperty('id');
  expect(createTagDiscovery({...tag, id: 'RAW'}, 'ios').identifiers).toEqual([
    {kind: 'id', value: 'RAW'}, {kind: 'idm', value: tag.idm},
  ]);
});

test.each([undefined, null, {}, {techTypes: null}, {techTypes: ['android.nfc.tech.NfcV', null, 3, 'android.nfc.tech.NfcV']}])('handles incomplete technology and NDEF metadata: %p', (tag) => {
  const result = createTagDiscovery(tag, 'android');
  expect(result.ndef).toEqual({status: 'unknown', records: []});
  expect(result.identifiers).toEqual([]);
  expect(getTechList(tag)).toEqual(tag?.techTypes ? ['NfcV'] : []);
});

test('does not infer an NFC Forum format from observed transports or a UID', () => {
  for (const tag of [{id: '04'}, {tech: 'mifare'}, {techTypes: ['android.nfc.tech.NfcA']}, {techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.IsoDep']}]) {
    const result = createTagDiscovery(tag, 'android');
    expect(result.capabilities).not.toContain('type2-memory');
    expect(result.tools.map((tool) => tool.screen)).not.toContain('Ntag21xMemoryScan');
  }
  const isoDep = createTagDiscovery({techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.IsoDep']}, 'android');
  expect(isoDep.tools).toEqual([
    {id: 'iso-dep-transceive', screen: 'CustomTransceive', params: {nfcTech: 'IsoDep'}},
    {id: 'iso-dep-script', screen: 'NfcScriptEditor', params: {nfcTech: 'IsoDep'}},
    {id: 'type4-ndef-inspector', screen: 'Type4NdefScan'},
  ]);
  expect(isoDep.limitations).toContain('type4-format-unconfirmed');
  expect(isoDep.capabilities).not.toContain('type4');
});

test('Type 2 inspector requires exact positive Android metadata', () => {
  const tag = {type: 'NFC Forum Type 2', techTypes: ['android.nfc.tech.NfcA']};
  expect(createTagDiscovery(tag, 'android').tools).toContainEqual({id: 'type2-memory', screen: 'Ntag21xMemoryScan'});
  expect(createTagDiscovery(tag, 'ios').capabilities).not.toContain('type2-memory');
  expect(createTagDiscovery({...tag, type: 'NFC Forum Type 4'}, 'android').capabilities).not.toContain('type2-memory');
});

test('NFC-V opens the inspector without a Type 5 format assertion or NFC-V script', () => {
  const result = createTagDiscovery({techTypes: ['android.nfc.tech.NfcV']}, 'android');
  expect(result.tools).toContainEqual({id: 'iso15693-inspector', screen: 'Type5MemoryScan'});
  expect(result.limitations).toContain('type5-format-unconfirmed');
  expect(result.tools).not.toContainEqual(expect.objectContaining({screen: 'NfcScriptEditor'}));
  expect(createTagDiscovery({tech: 'iso15693'}, 'ios').tools).toEqual([{id: 'iso15693-inspector', screen: 'Type5MemoryScan'}]);
});

test('an explicitly supplied empty NDEF list is preserved without claiming an empty tag', () => {
  expect(createTagDiscovery({ndefMessage: []}, 'ios').ndef).toEqual({status: 'available', records: []});
});

test('normalizes Type5 display identity on both platforms without mutating raw values', () => {
  const android = Object.freeze({id: '6367CA17080104E0', techTypes: ['android.nfc.tech.NfcV']});
  const ios = Object.freeze({id: 'E004010817CA6763', tech: 'iso15693'});
  for (const [tag, platform] of [[android, 'android'], [ios, 'ios']]) {
    const result = createTagDiscovery(tag, platform);
    expect(result.identifiers).toEqual([{kind: 'id', value: 'E004010817CA6763'}]);
    expect(result.type5Uid.platformTagIdRaw).toBe(tag.id);
  }
  expect(android.id).toBe('6367CA17080104E0');
  expect(createTagDiscovery({...android, techTypes: ['android.nfc.tech.NfcA']}, 'android').identifiers[0].value).toBe(android.id);
  for (const id of ['E004010817CA67E0', 'invalid']) {
    expect(createTagDiscovery({...android, id}, 'android').identifiers[0].value).toBe(id);
  }
});
