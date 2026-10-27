jest.mock('react-native', () => ({Platform: {OS: 'ios'}, Alert: {alert: jest.fn()}}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn().mockResolvedValue(undefined),
    getTag: jest.fn(),
    cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined),
    setAlertMessageIOS: jest.fn().mockResolvedValue(undefined),
    invalidateSessionWithErrorIOS: jest.fn(),
    ndefHandler: {getNdefMessage: jest.fn(), getNdefStatus: jest.fn().mockResolvedValue({status: 'read'})},
    nfcAHandler: {transceive: jest.fn()},
    nfcVHandler: {transceive: jest.fn()},
  },
  NfcTech: {Ndef: 'Ndef', NfcA: 'NfcA', NfcB: 'NfcB', NfcF: 'NfcF', NfcV: 'NfcV', IsoDep: 'IsoDep', MifareIOS: 'mifare', Iso15693IOS: 'iso15693', FelicaIOS: 'felica'},
  NfcError: {UserCancel: class extends Error {}, Timeout: class extends Error {}},
}));
jest.mock('reconnect.js', () => ({getOutlet: () => ({update: jest.fn()})}));

import {Alert, Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
import Ndef from 'react-native-nfc-manager/ndef-lib';
import {exploreTag, readTag} from '../src/services/nfc/tagService';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Platform.OS = 'ios';
  NfcManager.requestTechnology.mockResolvedValue(undefined);
  NfcManager.getTag.mockResolvedValue({tech: 'iso15693', id: 'E004010203040506'});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test.each([
  ['ios', ['mifare', 'IsoDep', 'iso15693', 'felica']],
  ['android', ['Ndef', 'NfcA', 'NfcB', 'NfcF', 'NfcV', 'IsoDep']],
])('%s discovery uses one raw session and retains the native object', async (platform, technologies) => {
  Platform.OS = platform;
  const tag = {id: 'RAW', idm: 'IDM', metadata: {keep: true}};
  NfcManager.getTag.mockResolvedValue(tag);
  const result = await exploreTag();
  expect(result.tag).toBe(tag);
  expect(result.discovery.ndef.status).toBe('unknown');
  expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
  expect(NfcManager.requestTechnology).toHaveBeenCalledWith(technologies, expect.any(Object));
  expect(NfcManager.getTag).toHaveBeenCalledTimes(1);
  expect(NfcManager.ndefHandler.getNdefStatus).not.toHaveBeenCalled();
  expect(NfcManager.nfcAHandler.transceive).not.toHaveBeenCalled();
  expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
  expect(NfcManager.setAlertMessageIOS).not.toHaveBeenCalled();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
});

test('cancellation before acquisition creates no session', async () => {
  expect(await exploreTag({shouldContinue: () => false})).toBeNull();
  expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
});

test('cancellation during acquisition performs no metadata request and cleans up', async () => {
  let active = true;
  NfcManager.requestTechnology.mockImplementation(async () => { active = false; });
  expect(await exploreTag({shouldContinue: () => active})).toBeNull();
  expect(NfcManager.getTag).not.toHaveBeenCalled();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('cancellation after getTag discards its result and cleans up', async () => {
  let active = true;
  NfcManager.getTag.mockImplementation(async () => { active = false; return {id: 'RAW'}; });
  expect(await exploreTag({shouldContinue: () => active})).toBeNull();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  expect(NfcManager.invalidateSessionWithErrorIOS).not.toHaveBeenCalled();
});

test('a native user cancellation is silent and releases the session', async () => {
  NfcManager.requestTechnology.mockRejectedValue(new NfcError.UserCancel());
  expect(await exploreTag()).toBeNull();
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(NfcManager.invalidateSessionWithErrorIOS).not.toHaveBeenCalled();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
});

test('lifecycle cancellation suppresses a native rejection during acquisition', async () => {
  let active = true;
  NfcManager.requestTechnology.mockImplementation(async () => { active = false; throw new Error('Session closed'); });
  expect(await exploreTag({shouldContinue: () => active})).toBeNull();
  expect(NfcManager.invalidateSessionWithErrorIOS).not.toHaveBeenCalled();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
});

test('ordinary acquisition errors still report failure and release the session', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  NfcManager.requestTechnology.mockRejectedValue(new Error('Native unavailable'));
  expect(await exploreTag()).toBeNull();
  expect(NfcManager.invalidateSessionWithErrorIOS).toHaveBeenCalledWith(expect.stringContaining('Native unavailable'));
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
});

test('the original NDEF scan still requests Ndef and queries status', async () => {
  const tag = {id: 'RAW'};
  NfcManager.getTag.mockResolvedValue(tag);
  expect(await readTag()).toBe(tag);
  expect(NfcManager.requestTechnology).toHaveBeenCalledWith(['Ndef'], expect.any(Object));
  expect(NfcManager.ndefHandler.getNdefStatus).toHaveBeenCalledTimes(1);
});

const type5Wire = [6, 5, 4, 3, 2, 1, 4, 0xe0];
const type5Tag = Object.freeze({id: '06050403020104E0', techTypes: ['android.nfc.tech.NfcV']});
function useType5Memory(message, {extended = false} = {}) {
  const memory = [0xe1, 0x40, 63, 0, 3,
    ...(extended ? [0xff, Math.floor(message.length / 256), message.length % 256] : [message.length]),
    ...message, 0xfe];
  while (memory.length % 4) memory.push(0);
  NfcManager.nfcVHandler.transceive.mockImplementation(async (frame) =>
    frame[1] === 0x2b ? [0, 4, ...type5Wire, 127, 3]
      : [0, ...memory.slice(frame[10] * 4, frame[10] * 4 + 4)],
  );
  return memory;
}

describe('Android Type 5 content enrichment', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    NfcManager.getTag.mockResolvedValue(type5Tag);
    NfcManager.ndefHandler.getNdefMessage.mockReset();
  });

  test('reads fresh NDEF only on a connected Ndef handle and keeps native JSON', async () => {
    NfcManager.requestTechnology.mockResolvedValue('Ndef');
    const tag = Object.freeze({...type5Tag, ndefMessage: null});
    const records = [Ndef.textRecord('日本語 & 中文'), Ndef.uriRecord('https://example.com')];
    NfcManager.getTag.mockResolvedValue(tag);
    NfcManager.ndefHandler.getNdefMessage.mockResolvedValue({ndefMessage: records});
    const result = await exploreTag();
    expect(result.tag).toBe(tag);
    expect(result.tag.ndefMessage).toBeNull();
    expect(result.discovery.ndef).toMatchObject({status: 'available', records, source: 'android-ndef-read'});
    expect(result.discovery.identifiers).toEqual([{kind: 'id', value: 'E004010203040506'}]);
    expect(NfcManager.ndefHandler.getNdefMessage).toHaveBeenCalledTimes(1);
    expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
    expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
  });

  test.each([[], null])('fresh empty/unavailable %p does not switch to raw commands', async (ndefMessage) => {
    NfcManager.requestTechnology.mockResolvedValue('Ndef');
    NfcManager.ndefHandler.getNdefMessage.mockResolvedValue({ndefMessage});
    const result = await exploreTag();
    expect(result.discovery.ndef.records).toEqual([]);
    expect(result.discovery.ndefAcquisition.status).toBe(ndefMessage === null ? 'unavailable' : 'available');
    expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
  });

  test('a failed fresh read preserves identity and a cancellation yields no result', async () => {
    NfcManager.requestTechnology.mockResolvedValue('Ndef');
    NfcManager.ndefHandler.getNdefMessage.mockRejectedValue(new Error('Tag lost'));
    expect((await exploreTag()).discovery.ndefAcquisition).toMatchObject({status: 'unavailable', failure: {message: 'Tag lost'}});
    expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
    NfcManager.ndefHandler.getNdefMessage.mockRejectedValue(new NfcError.UserCancel());
    expect(await exploreTag()).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('native records or another transport never start enrichment', async () => {
    const records = [Ndef.textRecord('native')];
    NfcManager.requestTechnology.mockResolvedValue('Ndef');
    NfcManager.getTag.mockResolvedValue({...type5Tag, ndefMessage: records});
    expect((await exploreTag()).discovery.ndef.records).toEqual(records);
    NfcManager.getTag.mockResolvedValue({id: '04', techTypes: ['android.nfc.tech.NfcA']});
    await exploreTag();
    expect(NfcManager.ndefHandler.getNdefMessage).not.toHaveBeenCalled();
    expect(NfcManager.nfcVHandler.transceive).not.toHaveBeenCalled();
  });

  test.each([false, true])('same NFC-V session reads complete NDEF and stops early (extended=%p)', async (extended) => {
    NfcManager.requestTechnology.mockResolvedValue('NfcV');
    const records = [Ndef.textRecord(extended ? 'x'.repeat(300) : '中文'), Ndef.uriRecord('https://example.com')];
    const message = Ndef.encodeMessage(records);
    useType5Memory(message, {extended});
    const result = await exploreTag();
    expect(result.tag).toBe(type5Tag);
    expect(result.discovery.ndef.records).toEqual(Ndef.decodeMessage(message));
    expect(result.discovery.ndefAcquisition).toMatchObject({source: 'type5-raw-read', evidence: {status: 'limited', readMode: 'ndef-only', stopReason: 'ndef-complete'}});
    const frames = NfcManager.nfcVHandler.transceive.mock.calls.map(([frame]) => frame);
    const count = Math.ceil((4 + (extended ? 4 : 2) + message.length) / 4);
    expect(frames).toEqual([[0x22, 0x2b, ...type5Wire], ...Array.from({length: count}, (_, address) => [0x22, 0x20, ...type5Wire, address])]);
    expect(result.discovery.ndefAcquisition.evidence.rawResponses).toHaveLength(count + 1);
    expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
    expect(NfcManager.getTag).toHaveBeenCalledTimes(1);
    expect(NfcManager.ndefHandler.getNdefMessage).not.toHaveBeenCalled();
  });

  test('cancel during raw read keeps subsequent commands and navigation silent', async () => {
    NfcManager.requestTechnology.mockResolvedValue('NfcV');
    let active = true;
    NfcManager.nfcVHandler.transceive.mockImplementation(async () => { active = false; return [0, 4, ...type5Wire, 127, 3]; });
    expect(await exploreTag({shouldContinue: () => active})).toBeNull();
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(1);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  test('native cancellation during raw metadata before a block yields no result', async () => {
    NfcManager.requestTechnology.mockResolvedValue('NfcV');
    NfcManager.nfcVHandler.transceive.mockRejectedValue(new NfcError.UserCancel());
    expect(await exploreTag()).toBeNull();
    expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(1);
  });
});

test('native cancellation at the first raw block returns no Home result', async () => {
  Platform.OS = 'android';
  NfcManager.getTag.mockResolvedValue(type5Tag);
  NfcManager.requestTechnology.mockResolvedValue('NfcV');
  NfcManager.nfcVHandler.transceive.mockResolvedValueOnce([0, 4, ...type5Wire, 127, 3]).mockRejectedValueOnce(new NfcError.UserCancel());
  expect(await exploreTag()).toBeNull();
  expect(NfcManager.nfcVHandler.transceive).toHaveBeenCalledTimes(2);
  expect(Alert.alert).not.toHaveBeenCalled();
});
