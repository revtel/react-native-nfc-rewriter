jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  Alert: {alert: jest.fn()},
}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    requestTechnology: jest.fn().mockResolvedValue(undefined),
    setAlertMessageIOS: jest.fn().mockResolvedValue(undefined),
    cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined),
    invalidateSessionWithErrorIOS: jest.fn(),
  },
  NfcError: {
    UserCancel: class extends Error {},
    Timeout: class extends Error {},
  },
}));
jest.mock('reconnect.js', () => ({
  getOutlet: jest.fn(() => ({update: jest.fn()})),
}));

import {Alert, Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
import {getOutlet} from 'reconnect.js';
import {i18n, translateText as tr} from '../src/i18n';
import {runNfcSession} from '../src/services/nfc/session';

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Platform.OS = 'ios';
  await i18n.changeLanguage('zh-Hant');
});
afterEach(async () => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  await i18n.changeLanguage('en');
});

test('an iOS session retains its language after an in-app change', async () => {
  await runNfcSession({
    technology: 'Ndef',
    operation: async () => {
      await i18n.changeLanguage('ja');
      return [1, 2];
    },
  });
  expect(NfcManager.requestTechnology).toHaveBeenLastCalledWith('Ndef', {
    alertMessage: '準備掃描 NFC',
  });
  expect(NfcManager.setAlertMessageIOS).toHaveBeenLastCalledWith(
    tr('Success', {}, 'zh-Hant'),
  );
  await runNfcSession({technology: 'Ndef', operation: async () => []});
  expect(NfcManager.requestTechnology).toHaveBeenLastCalledWith('Ndef', {
    alertMessage: tr('Ready to scan NFC', {}, 'ja'),
  });
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(2);
});

test('Android prompt language is captured and cleanup always hides it', async () => {
  Platform.OS = 'android';
  const update = jest.fn();
  getOutlet.mockReturnValue({update});
  await runNfcSession({
    technology: 'Ndef',
    operation: async () => {
      await i18n.changeLanguage('ja');
      throw new NfcError.Timeout();
    },
  });
  expect(update).toHaveBeenCalledWith({
    visible: true,
    message: '準備掃描 NFC',
    cancelLabel: tr('CANCEL', {}, 'zh-Hant'),
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    tr('NFC Session Timeout', {}, 'zh-Hant'),
  );
  jest.runOnlyPendingTimers();
  expect(update).toHaveBeenLastCalledWith({visible: false});
});

test('user cancellation stays silent and still closes the session', async () => {
  const result = await runNfcSession({
    technology: 'Ndef',
    operation: async () => {
      throw new NfcError.UserCancel();
    },
  });
  expect(result.success).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(NfcManager.invalidateSessionWithErrorIOS).not.toHaveBeenCalled();
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
});
