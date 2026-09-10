import {Platform} from 'react-native';
import NfcManager, {
  NfcEvents,
  NfcTech,
} from 'react-native-nfc-manager';
import {
  handleNfcException,
  runNfcSession,
  withAndroidPrompt,
} from './session';

async function readTag() {
  const result = await runNfcSession({
    technology: [NfcTech.Ndef],
    silent: true,
    operation: async () => {
      const tag = await NfcManager.getTag();
      tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus();
      return tag;
    },
  });
  return result.success ? result.value : null;
}

async function readNxpSigNtag2xx() {
  const result = await runNfcSession({
    technology: [NfcTech.NfcA],
    silent: true,
    operation: async () => {
      const tag = await NfcManager.getTag();
      tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus();
      tag.nxpBytes = await NfcManager.nfcAHandler.transceive([0x3c, 0x00]);
      return tag;
    },
  });
  return result.success ? result.value : null;
}

function readNdefOnce() {
  return withAndroidPrompt(
    () =>
      new Promise((resolve) => {
        let tagFound = null;
        const cleanUp = () => {
          NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
          NfcManager.setEventListener(NfcEvents.SessionClosed, null);
        };

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
            handleNfcException(error);
          }
          cleanUp();
          if (!tagFound) {
            resolve();
          }
        });

        NfcManager.registerTagEvent();
      }),
  );
}

export {readNdefOnce, readNxpSigNtag2xx, readTag};
