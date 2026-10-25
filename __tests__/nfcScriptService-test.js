jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    nfcAHandler: {transceive: jest.fn()},
    isoDepHandler: {transceive: jest.fn()},
    requestTechnology: jest.fn().mockResolvedValue(undefined),
    cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined),
    setAlertMessageIOS: jest.fn().mockResolvedValue(undefined),
  },
  NfcTech: {NfcA: 'NfcA', IsoDep: 'IsoDep'},
}));
jest.mock('../src/services/nfc/session', () => ({runNfcSession: jest.fn()}));
jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  Alert: {alert: jest.fn()},
}));
jest.mock('../src/i18n', () => ({sessionTranslator: () => (text) => text}));
jest.mock('reconnect.js', () => ({getOutlet: jest.fn()}));

import NfcManager from 'react-native-nfc-manager';
import {runNfcSession} from '../src/services/nfc/session';
import {runNfcScript} from '../src/services/nfc/scriptService';
import {newScript} from '../src/features/nfc-script/model';

beforeEach(() => {
  jest.clearAllMocks();
  runNfcSession.mockImplementation(async ({operation}) => ({
    success: true,
    value: await operation(),
  }));
});

test.each(['NfcA', 'IsoDep'])('runs %s in one session', async (tech) => {
  const handler =
    tech === 'NfcA' ? NfcManager.nfcAHandler : NfcManager.isoDepHandler;
  handler.transceive.mockResolvedValue(tech === 'NfcA' ? [0x0a] : [0x90, 0]);
  const result = await runNfcScript({
    ...newScript(tech),
    steps: [{type: 'transceive', template: '30 04'}],
  });
  expect(result.success).toBe(true);
  expect(runNfcSession).toHaveBeenCalledTimes(1);
  expect(runNfcSession.mock.calls[0][0].technology).toEqual([tech]);
  expect(handler.transceive).toHaveBeenCalledWith([0x30, 0x04]);
});

test('invalid scripts do not open NFC session', async () => {
  const result = await runNfcScript({...newScript(), version: 99});
  expect(result.success).toBe(false);
  expect(runNfcSession).not.toHaveBeenCalled();
});

const read = {type: 'transceive', template: '90 6A 00 00 00'};
const guard = {type: 'assert-response', source: 'data', length: 0, expectedHex: '', expectedSw: '9100'};

test.each([
  [{...guard, length: ''}],
  [read, {...guard, expectedHex: null}],
  [read, {...guard, expectedSw: undefined}],
  [read, {...guard, source: 'raw', length: 2, expectedHex: '91 00', expectedSw: '9000'}],
  [{type: 'set', name: '__response', expression: '1'}, guard],
  [read, {type: 'if', left: '0', operator: '==', right: '1', then: [{...guard, expectedHex: '${uid:bytes}'}], else: []}],
])('rejects invalid assertion before any session or APDU: %p', async (...steps) => {
  const result = await runNfcScript({...newScript('IsoDep'), steps});
  expect(result.success).toBe(false);
  expect(result.trace).toEqual([]);
  expect(runNfcSession).not.toHaveBeenCalled();
  expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
  expect(NfcManager.isoDepHandler.transceive).not.toHaveBeenCalled();
});

describe('assertions within the real session cleanup wrapper', () => {
  beforeEach(() => {
    runNfcSession.mockImplementation(
      jest.requireActual('../src/services/nfc/session').runNfcSession,
    );
  });

  test.each(['NfcA', 'IsoDep'])('passes and fails in one cleaned-up %s session', async (tech) => {
    const handler = tech === 'NfcA' ? NfcManager.nfcAHandler : NfcManager.isoDepHandler;
    const check = tech === 'NfcA' ? {type: 'assert-response', source: 'data', length: 0, expectedHex: ''} : guard;
    const raw = tech === 'NfcA' ? [] : [0x91, 0];
    handler.transceive.mockResolvedValue(raw);
    const passed = await runNfcScript({...newScript(tech), steps: [read, check, read]});
    expect(passed.success).toBe(true);
    expect(passed.trace[1].assertion.passed).toBe(true);
    expect(handler.transceive).toHaveBeenCalledTimes(2);
    expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    handler.transceive.mockResolvedValue([0x04, ...raw]);
    const failed = await runNfcScript({...newScript(tech), steps: [read, check, {type: 'transceive', template: '90 CA 00 00 00'}]});
    expect(failed.success).toBe(false);
    expect(failed.trace).toHaveLength(2);
    expect(failed.trace[1].assertion.failure).toBe('length');
    expect(handler.transceive).toHaveBeenCalledTimes(1);
    expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
    expect(runNfcSession).toHaveBeenCalledWith(expect.objectContaining({silent: true, successMessage: null, technology: [tech]}));
    expect(NfcManager.setAlertMessageIOS).not.toHaveBeenCalled();
  });

  test('a transport error preserves the earlier response and cleans up once', async () => {
    NfcManager.isoDepHandler.transceive.mockResolvedValueOnce([0x91, 0]).mockRejectedValueOnce(new Error('tag removed'));
    const result = await runNfcScript({...newScript('IsoDep'), steps: [read, guard, read, read]});
    expect(result.success).toBe(false);
    expect(result.trace[0].response.raw).toEqual([0x91, 0]);
    expect(result.trace[1].assertion.passed).toBe(true);
    expect(result.trace[2].error).toBe('tag removed');
    expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(2);
    expect(NfcManager.requestTechnology).toHaveBeenCalledTimes(1);
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });
});
