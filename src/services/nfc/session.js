import {Alert, Platform} from 'react-native';
import NfcManager, {NfcError} from 'react-native-nfc-manager';
import {getOutlet} from 'reconnect.js';

function setAndroidPrompt(visible) {
  if (Platform.OS === 'android') {
    getOutlet('androidPrompt').update({
      visible,
      ...(visible ? {message: 'Ready to scan NFC'} : {}),
    });
  }
}

function handleNfcException(error) {
  if (error instanceof NfcError.UserCancel) {
    return;
  }
  if (error instanceof NfcError.Timeout) {
    Alert.alert('NFC Session Timeout');
    return;
  }

  console.warn(error);
  if (Platform.OS === 'ios') {
    NfcManager.invalidateSessionWithErrorIOS(`${error}`);
  } else {
    Alert.alert('NFC Error', `${error}`);
  }
}

async function withAndroidPrompt(operation) {
  setAndroidPrompt(true);
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
  return withAndroidPrompt(async () => {
    try {
      await NfcManager.requestTechnology(technology, requestOptions);
      const value = await operation();
      if (Platform.OS === 'ios' && successMessage) {
        await NfcManager.setAlertMessageIOS(successMessage);
      }
      return {success: true, value};
    } catch (error) {
      if (silent) {
        console.log(error);
      } else {
        handleNfcException(error);
      }
      return {success: false, error};
    } finally {
      await NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
  });
}

export {handleNfcException, runNfcSession, withAndroidPrompt};
