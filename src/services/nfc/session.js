import {sessionTranslator} from '../../i18n';
import {Alert, Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
import {getOutlet} from 'reconnect.js';

function setAndroidPrompt(visible, translate) {
  if (Platform.OS === 'android') {
    getOutlet('androidPrompt').update({
      visible,
      ...(visible
        ? {
            message: translate('Ready to scan NFC'),
            cancelLabel: translate('CANCEL'),
          }
        : {}),
    });
  }
}

function handleNfcException(error, translate = sessionTranslator()) {
  if (error instanceof NfcError.UserCancel) {
    return;
  }
  if (error instanceof NfcError.Timeout) {
    Alert.alert(translate('NFC Session Timeout'));
    return;
  }

  console.warn(error);
  if (Platform.OS === 'ios') {
    NfcManager.invalidateSessionWithErrorIOS(
      translate('The operation failed. Technical details: {{details}}', {
        details: String(error),
      }),
    );
  } else {
    Alert.alert(
      translate('NFC Error'),
      translate('The operation failed. Technical details: {{details}}', {
        details: String(error),
      }),
    );
  }
}

async function withAndroidPrompt(operation, translate = sessionTranslator()) {
  setAndroidPrompt(true, translate);
  try {
    return await operation();
  } finally {
    if (Platform.OS === 'android') {
      setTimeout(() => setAndroidPrompt(false), 800);
    }
  }
}

async function runNfcSession({
  technology,
  requestOptions,
  operation,
  silent = false,
  successMessage = 'Success',
}) {
  const translate = sessionTranslator();
  return withAndroidPrompt(async () => {
    try {
      const connectedTechnology = await NfcManager.requestTechnology(
        technology,
        {
          ...requestOptions,
          alertMessage: translate(
            requestOptions?.alertMessage || 'Ready to scan NFC',
          ),
        },
      );
      const value = await operation(connectedTechnology);
      if (Platform.OS === 'ios' && successMessage) {
        await NfcManager.setAlertMessageIOS(translate(successMessage));
      }
      return {success: true, value};
    } catch (error) {
      if (silent) {
        console.log(error);
      } else {
        handleNfcException(error, translate);
      }
      return {success: false, error};
    } finally {
      await NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
  }, translate);
}

export {handleNfcException, runNfcSession, withAndroidPrompt};
