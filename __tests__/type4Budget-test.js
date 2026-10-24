jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {isoDepHandler: {transceive: jest.fn()}},
  NfcTech: {IsoDep: 'IsoDep'},
  NfcError: {UserCancel: class extends Error {}},
}));
jest.mock('../src/services/nfc/session', () => ({runNfcSession: jest.fn()}));
// Reach the budget boundary without expanding the production API or cap. The
// normal-limit suite independently checks the actual fixed cap of 1024.
jest.mock('../src/features/type4-ndef/protocol', () => ({
  ...jest.requireActual('../src/features/type4-ndef/protocol'),
  MAX_COMMANDS: 7,
}));

import {Platform} from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import {runNfcSession} from '../src/services/nfc/session';
import {scanType4Ndef} from '../src/services/nfc/type4ScanService';

it('stops before attempted APDU8 and never decodes a full payload lacking recheck', async () => {
  const originalPlatform = Platform.OS;
  Platform.OS = 'android';
  runNfcSession.mockImplementation(async ({operation}) => ({
    success: true,
    value: await operation(),
  }));
  NfcManager.isoDepHandler.transceive
    .mockResolvedValueOnce([0x90, 0])
    .mockResolvedValueOnce([0x90, 0])
    .mockResolvedValueOnce([0, 15, 0x20, 0, 240, 0, 1, 0x90, 0])
    .mockResolvedValueOnce([4, 6, 0xe1, 4, 1, 0, 0, 255, 0x90, 0])
    .mockResolvedValueOnce([0x90, 0])
    .mockResolvedValueOnce([0, 3, 0x90, 0])
    .mockResolvedValueOnce([0xd0, 0, 0, 0x90, 0]);
  try {
    const result = await scanType4Ndef();
    expect(result).toMatchObject({
      status: 'limited',
      scope: {commandsSent: 7, readBytes: 3, limits: ['command-limit']},
      consistency: {status: 'not-checked'},
      ndef: {status: 'unavailable', rawBytes: [0xd0, 0, 0], records: []},
      failure: null,
    });
    expect(NfcManager.isoDepHandler.transceive).toHaveBeenCalledTimes(7);
    expect(result.transcript).toHaveLength(7);
  } finally {
    Platform.OS = originalPlatform;
  }
});
