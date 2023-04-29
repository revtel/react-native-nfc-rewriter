import {Platform, Alert} from 'react-native';
import NfcManager, {
  NfcTech,
  Ndef,
  NfcEvents,
  NfcError,
} from 'react-native-nfc-manager';
import {getOutlet} from 'reconnect.js';

let beforeTransceive = null;

function setBeforeTransceive(callback) {
  beforeTransceive = callback;
}

class ErrSuccess extends Error {}

const withAndroidPrompt = (fn) => {
  async function wrapper() {
    try {
      if (Platform.OS === 'android') {
        getOutlet('androidPrompt').update({
          visible: true,
          message: 'Ready to scan NFC',
        });
      }

      const resp = await fn.apply(null, arguments);

      if (Platform.OS === 'android') {
        getOutlet('androidPrompt').update({
          visible: true,
          message: 'Completed',
        });
      }

      return resp;
    } catch (ex) {
      throw ex;
    } finally {
      if (Platform.OS === 'android') {
        setTimeout(() => {
          getOutlet('androidPrompt').update({
            visible: false,
          });
        }, 800);
      }
    }
  }

  return wrapper;
};

const handleException = (ex) => {
  if (ex instanceof NfcError.UserCancel) {
    // bypass
  } else if (ex instanceof NfcError.Timeout) {
    Alert.alert('NFC Session Timeout');
  } else {
    console.warn(ex);

    if (Platform.OS === 'ios') {
      NfcManager.invalidateSessionWithErrorIOS(`${ex}`);
    } else {
      Alert.alert('NFC Error', `${ex}`);
    }
  }
};

class NfcProxy {
  async init() {
    const supported = await NfcManager.isSupported();
    if (supported) {
      await NfcManager.start();
    }
    return supported;
  }

  async isEnabled() {
    return NfcManager.isEnabled();
  }

  async goToNfcSetting() {
    return NfcManager.goToNfcSetting();
  }

  readNdefOnce = withAndroidPrompt(() => {
    const cleanUp = () => {
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    return new Promise((resolve) => {
      let tagFound = null;

      NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag) => {
        tagFound = tag;
        resolve(tagFound);

        if (Platform.OS === 'ios') {
          NfcManager.setAlertMessageIOS('NDEF tag found');
        }

        NfcManager.unregisterTagEvent().catch(() => 0);
      });

      NfcManager.setEventListener(NfcEvents.SessionClosed, (error) => {
        if (error) {
          handleException(error);
        }

        cleanUp();
        if (!tagFound) {
          resolve();
        }
      });

      NfcManager.registerTagEvent();
    });
  });

  readTag = withAndroidPrompt(async () => {
    let tag = null;

    try {
      await NfcManager.requestTechnology([NfcTech.Ndef]);

      tag = await NfcManager.getTag();
      tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus();

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Success');
      }
    } catch (ex) {
      // for tag reading, we don't actually need to show any error
      console.log(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return tag;
  });

  writeNdef = withAndroidPrompt(async ({type, value}) => {
    let result = false;

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Ready to write some NDEF',
      });

      let bytes = null;
      if (type === 'TEXT') {
        bytes = Ndef.encodeMessage([Ndef.textRecord(value)]);
      } else if (type === 'URI') {
        bytes = Ndef.encodeMessage([Ndef.uriRecord(value)]);
      } else if (type === 'WIFI_SIMPLE') {
        bytes = Ndef.encodeMessage([Ndef.wifiSimpleRecord(value)]);
      } else if (type === 'VCARD') {
        const {name, tel, org, email} = value;
        const vCard = `BEGIN:VCARD\nVERSION:2.1\nN:;${name}\nORG: ${org}\nTEL;HOME:${tel}\nEMAIL:${email}\nEND:VCARD`;

        bytes = Ndef.encodeMessage([
          Ndef.record(Ndef.TNF_MIME_MEDIA, 'text/vcard', [], vCard),
        ]);
      }

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);

        if (Platform.OS === 'ios') {
          await NfcManager.setAlertMessageIOS('Success');
        }

        result = true;
      }
    } catch (ex) {
      handleException(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return result;
  });

  customTransceiveNfcA = withAndroidPrompt(async (commands, onPostExecute) => {
    let result = false;
    const responses = [];

    try {
      await NfcManager.requestTechnology([NfcTech.NfcA]);

      let cmdIdx = 0;
      for (const command of commands) {
        let modifiedCommand = null;
        if (typeof beforeTransceive === 'function') {
          modifiedCommand = beforeTransceive({
            cmdIdx,
            commands,
            responses,
          });
        }

        const {type, payload} = modifiedCommand || command;
        let resp = null;
        if (type === 'command') {
          console.warn(
            payload
              .map((byte) => ('00' + byte.toString(16)).slice(-2))
              .join(' '),
          );
          resp = await NfcManager.nfcAHandler.transceive(payload);
        } else if (type === 'delay') {
          await delay(payload);
        }
        responses.push(resp);
        cmdIdx++;
      }

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Success');
      }

      result = true;

      if (typeof onPostExecute === 'function') {
        await onPostExecute([result, responses]);
      }
    } catch (ex) {
      handleException(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return [result, responses];
  });

  eraseNfcA = withAndroidPrompt(async ({format = false} = {}) => {
    let result = false;

    try {
      await NfcManager.requestTechnology([NfcTech.NfcA]);

      const cmdReadCC = [0x30, 0x03];
      const [e1, ver, size, access] = await NfcManager.nfcAHandler.transceive(
        cmdReadCC,
      );

      const blocks = (size * 8) / 4;

      for (let i = 0; i < blocks; i++) {
        const blockNo = i + 0x04; // user block starts from 0x04
        const cmdWriteZero = [0xa2, blockNo, 0x0, 0x0, 0x0, 0x0];
        await NfcManager.nfcAHandler.transceive(cmdWriteZero);
      }

      if (format) {
        const cmdNdefFormat = [0xa2, 0x04, 0x03, 0x00, 0xfe, 0x00];
        await NfcManager.nfcAHandler.transceive(cmdNdefFormat);

        if (Platform.OS === 'ios') {
          await NfcManager.setAlertMessageIOS('Success');
        }

        result = true;
      } else {
        result = false;
      }
    } catch (ex) {
      handleException(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return result;
  });

  customTransceiveIsoDep = withAndroidPrompt(
    async (commands, onPostExecute) => {
      let result = false;
      const responses = [];

      try {
        await NfcManager.requestTechnology([NfcTech.IsoDep]);

        for (const {type, payload} of commands) {
          let resp = null;
          if (type === 'command') {
            console.log(
              '>>> ' +
                payload.map((b) => ('00' + b.toString(16)).slice(-2)).join(' '),
            );
            resp = await NfcManager.isoDepHandler.transceive(payload);
            console.log(
              '<<< ' +
                resp.map((b) => ('00' + b.toString(16)).slice(-2)).join(' '),
            );
          } else if (type === 'delay') {
            await delay(payload);
          }
          responses.push(resp);
        }

        if (Platform.OS === 'ios') {
          await NfcManager.setAlertMessageIOS('Success');
        }

        result = true;

        if (typeof onPostExecute === 'function') {
          await onPostExecute([result, responses]);
        }
      } catch (ex) {
        console.warn(ex);
        handleException(ex);
      } finally {
        NfcManager.cancelTechnologyRequest();
      }

      return [result, responses];
    },
  );

  customTransceiveNfcV = withAndroidPrompt(async (commands, onPostExecute) => {
    let result = false;
    const responses = [];

    try {
      await NfcManager.requestTechnology([NfcTech.NfcV]);

      for (const {type, payload} of commands) {
        let resp = null;
        if (type === 'command') {
          console.log(
            '>>> ' +
              payload.map((b) => ('00' + b.toString(16)).slice(-2)).join(' '),
          );
          resp = await NfcManager.nfcVHandler.transceive(payload);
          console.log(
            '<<< ' +
              resp.map((b) => ('00' + b.toString(16)).slice(-2)).join(' '),
          );
        } else if (type === 'delay') {
          await delay(payload);
        }
        responses.push(resp);
      }

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Success');
      }

      result = true;

      if (typeof onPostExecute === 'function') {
        await onPostExecute([result, responses]);
      }
    } catch (ex) {
      console.warn(ex);
      handleException(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return [result, responses];
  });

  makeReadOnly = withAndroidPrompt(async () => {
    let result = false;

    try {
      await NfcManager.requestTechnology([NfcTech.Ndef]);
      await NfcManager.ndefHandler.makeReadOnly();

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Success');
      }

      result = true;
    } catch (ex) {
      console.warn(ex);
      handleException(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return result;
  });

  formatNdefAndroid = withAndroidPrompt(async () => {
    let result = false;

    try {
      await NfcManager.requestTechnology([NfcTech.NdefFormatable]);
      const bytes = Ndef.encodeMessage([Ndef.textRecord('hello nfc')]);
      await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes);

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Success');
      }

      result = true;
    } catch (ex) {
      console.warn(ex);
      handleException(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return result;
  });

  readNxpSigNtag2xx = withAndroidPrompt(async () => {
    let tag = null;

    try {
      await NfcManager.requestTechnology([NfcTech.NfcA]);

      tag = await NfcManager.getTag();
      tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus();
      tag.nxpBytes = await NfcManager.nfcAHandler.transceive([0x3c, 0x00]);

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Success');
      }
    } catch (ex) {
      // for tag reading, we don't actually need to show any error
      console.log(ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }

    return tag;
  });
}

// ------------------------
//  Utils
// ------------------------
const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export default new NfcProxy();
export {ErrSuccess, setBeforeTransceive};
