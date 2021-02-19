import {Platform} from 'react-native';
import NfcManager, {NfcTech, Ndef, NfcEvents} from 'react-native-nfc-manager';
import * as AppContext from './AppContext';

class ErrSuccess extends Error {}

const withAndroidPrompt = (fn) => {
  async function wrapper() {
    try {
      if (Platform.OS === 'android') {
        AppContext.Actions.setShowNfcPrompt(true);
      }

      return await fn.apply(null, arguments);
    } catch (ex) {
      throw ex;
    } finally {
      if (Platform.OS === 'android') {
        AppContext.Actions.setShowNfcPrompt(false);
      }
    }
  }

  return wrapper;
};

class NfcProxy {
  constructor() {
    NfcManager.start();
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

      NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
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
    } catch (ex) {
      console.warn(ex);
    }

    NfcManager.cancelTechnologyRequest().catch(() => 0);
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
        console.warn(type, value);
        bytes = Ndef.encodeMessage([Ndef.textRecord(value)]);
      } else if (type === 'URI') {
        bytes = Ndef.encodeMessage([Ndef.uriRecord(value)]);
      } else if (type === 'WIFI_SIMPLE') {
        bytes = Ndef.encodeMessage([Ndef.wifiSimpleRecord(value)]);
      }

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);

        if (Platform.OS === 'ios') {
          await NfcManager.setAlertMessageIOS('Successfully write NDEF');
        }
      }

      result = true;
    } catch (ex) {
      console.warn(ex);
    }

    NfcManager.cancelTechnologyRequest().catch(() => 0);
    return result;
  });

  customTransceiveNfcA = withAndroidPrompt(async (payloads) => {
    let err = new ErrSuccess();
    let responses = [];

    try {
      await NfcManager.requestTechnology([NfcTech.NfcA]);

      for (const payload of payloads) {
        const resp = await NfcManager.nfcAHandler.transceive(payload);
        responses.push(resp);
        await delay(100);
      }
    } catch (ex) {
      console.warn(ex);
      err = ex;
    }

    NfcManager.cancelTechnologyRequest().catch(() => 0);

    if (err instanceof ErrSuccess) {
      return [null, responses];
    }

    return [err, responses];
  });
}

// ------------------------
//  Utils
// ------------------------
const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export default new NfcProxy();
export {ErrSuccess};
