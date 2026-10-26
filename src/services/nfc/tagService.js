import {sessionTranslator} from '../../i18n';
import {Platform} from 'react-native';
import NfcManager, {NfcEvents, NfcTech} from 'react-native-nfc-manager';
import {handleNfcException, runNfcSession, withAndroidPrompt} from './session';
import {createTagDiscovery} from '../../features/tag-discovery/model';

async function exploreTag({shouldContinue = () => true} = {}) {
  if (!shouldContinue()) {
    return null;
  }
  const platform = Platform.OS;
  const translate = sessionTranslator();
  const result = await runNfcSession({
    technology: platform === 'ios'
      ? [NfcTech.MifareIOS, NfcTech.IsoDep, NfcTech.Iso15693IOS, NfcTech.FelicaIOS]
      : [NfcTech.NfcA, NfcTech.NfcB, NfcTech.NfcF, NfcTech.NfcV, NfcTech.IsoDep],
    silent: true,
    successMessage: '',
    operation: async () => {
      if (!shouldContinue()) {
        return null;
      }
      const tag = await NfcManager.getTag();
      if (!shouldContinue() || !tag) {
        return null;
      }
      return {tag, discovery: createTagDiscovery(tag, platform)};
    },
  });
  if (!shouldContinue()) {
    return null;
  }
  if (!result.success) {
    handleNfcException(result.error, translate);
    return null;
  }
  return result.value;
}

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
  const translate = sessionTranslator();
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
            NfcManager.setAlertMessageIOS(translate('NDEF tag found'));
          }
          NfcManager.unregisterTagEvent().catch(() => 0);
        });

        NfcManager.setEventListener(NfcEvents.SessionClosed, (error) => {
          if (error) {
            handleNfcException(error, translate);
          }
          cleanUp();
          if (!tagFound) {
            resolve();
          }
        });

        NfcManager.registerTagEvent({
          alertMessage: translate('Ready to scan NFC'),
        });
      }),
    translate,
  );
}

export {exploreTag, readNdefOnce, readNxpSigNtag2xx, readTag};
