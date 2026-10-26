jest.mock('react-native', () => ({Platform: {OS: 'ios'}, Alert: {alert: jest.fn()}}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn().mockResolvedValue(undefined),
    getTag: jest.fn(),
    cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined),
    setAlertMessageIOS: jest.fn().mockResolvedValue(undefined),
    invalidateSessionWithErrorIOS: jest.fn(),
    ndefHandler: {getNdefStatus: jest.fn().mockResolvedValue({status: 'read'})},
    nfcAHandler: {transceive: jest.fn()},
    nfcVHandler: {transceive: jest.fn()},
  },
  NfcTech: {Ndef: 'Ndef', NfcA: 'NfcA', NfcB: 'NfcB', NfcF: 'NfcF', NfcV: 'NfcV', IsoDep: 'IsoDep', MifareIOS: 'mifare', Iso15693IOS: 'iso15693', FelicaIOS: 'felica'},
  NfcError: {UserCancel: class extends Error {}, Timeout: class extends Error {}},
}));
jest.mock('reconnect.js', () => ({getOutlet: () => ({update: jest.fn()})}));

import {Alert, Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
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
  ['android', ['NfcA', 'NfcB', 'NfcF', 'NfcV', 'IsoDep']],
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
