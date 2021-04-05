import {Platform} from 'react-native';
import NfcManager, {
  NfcTech,
  Ndef,
  NfcEvents,
  NfcErrorIOS,
} from 'react-native-nfc-manager';
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

      await NfcManager.cancelTechnologyRequest();
    } catch (ex) {
      if (NfcErrorIOS.parse(ex) !== NfcErrorIOS.errCodes.userCancel) {
        console.warn(ex);
      }
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

      await NfcManager.cancelTechnologyRequest();
    } catch (ex) {
      if (NfcErrorIOS.parse(ex) !== NfcErrorIOS.errCodes.userCancel) {
        console.warn(ex);
      }
    }

    return result;
  });

  customTransceiveNfcA = withAndroidPrompt(async (commands) => {
    const responses = [];

    try {
      await NfcManager.requestTechnology([NfcTech.NfcA]);

      for (const {type, payload} of commands) {
        let resp = null;
        if (type === 'command') {
          resp = await NfcManager.nfcAHandler.transceive(payload);
        } else if (type === 'delay') {
          await delay(payload);
        }
        responses.push(resp);
      }

      await NfcManager.cancelTechnologyRequest();
    } catch (ex) {
      if (NfcErrorIOS.parse(ex) !== NfcErrorIOS.errCodes.userCancel) {
        console.warn(ex);
      }
    }

    return responses;
  });

  eraseNfcA = withAndroidPrompt(async ({format = false} = {}) => {
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
      }

      await NfcManager.cancelTechnologyRequest();
    } catch (ex) {
      if (NfcErrorIOS.parse(ex) !== NfcErrorIOS.errCodes.userCancel) {
        console.warn(ex);
      }
    }
  });

  customTransceiveIsoDep = withAndroidPrompt(async (commands) => {
    const responses = [];

    try {
      await NfcManager.requestTechnology([NfcTech.IsoDep]);

      for (const {type, payload} of commands) {
        let resp = null;
        if (type === 'command') {
          resp = await NfcManager.isoDepHandler.transceive(payload);
        } else if (type === 'delay') {
          await delay(payload);
        }
        responses.push(resp);
      }

      await NfcManager.cancelTechnologyRequest();
    } catch (ex) {
      if (NfcErrorIOS.parse(ex) !== NfcErrorIOS.errCodes.userCancel) {
        console.warn(ex);
      }
    }

    return responses;
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
