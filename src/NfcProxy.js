import {Platform} from 'react-native';
import NfcManager, {NfcTech, Ndef, NfcEvents} from 'react-native-nfc-manager';
import {AppEvents, AppEventName} from './AppEvents';

const NfcAndroidUI = AppEvents.get(AppEventName.NFC_SCAN_UI);

class ErrSuccess extends Error {}

class NfcProxy {
  constructor() {
    NfcManager.start();
  }

  readNdefOnce = () => {
    const cleanUp = () => {
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    return new Promise((resolve) => {
      let tagFound = null;

      NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag) => {
        tagFound = tag;
        resolve(tagFound);
        NfcManager.setAlertMessageIOS('NDEF tag found');
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
  };

  readTag = async () => {
    let tag = null;
    try {
      if (Platform.OS === 'android') {
        NfcAndroidUI.emit('OPEN');
      }

      await NfcManager.requestTechnology([NfcTech.Ndef]);

      tag = await NfcManager.getTag();
      tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus();
    } catch (ex) {
      console.warn(ex);
    }

    this.abort();
    return tag;
  };

  writeNdef = async ({type, value}) => {
    let result = false;
    try {
      if (Platform.OS === 'android') {
        NfcAndroidUI.emit('OPEN');
      }

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

    this.abort();
    return result;
  };

  customTransceiveNfcA = async (payloads) => {
    let err = new ErrSuccess();
    let responses = [];

    try {
      if (Platform.OS == 'android') {
        NfcAndroidUI.emit('OPEN');
      }

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

    this.abort();

    if (err instanceof ErrSuccess) {
      return [null, responses];
    }

    return [err, responses];
  };

  abort = async () => {
    NfcManager.cancelTechnologyRequest().catch(() => 0);
    NfcAndroidUI.emit('CLOSE');
  };
}

// ------------------------
//  Utils
// ------------------------
const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export default new NfcProxy();
export {ErrSuccess};
