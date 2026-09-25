jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    nfcAHandler: {transceive: jest.fn()},
    isoDepHandler: {transceive: jest.fn()},
  },
  NfcTech: {NfcA: 'NfcA', IsoDep: 'IsoDep'},
}));
jest.mock('../src/services/nfc/session', () => ({runNfcSession: jest.fn()}));

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
