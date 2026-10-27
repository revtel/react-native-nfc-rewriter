import {sessionTranslator} from '../../i18n';
import {Platform} from 'react-native';
import NfcManager, {
  NfcEvents,
  NfcTech,
  NfcError,
} from 'react-native-nfc-manager';
import {handleNfcException, runNfcSession, withAndroidPrompt} from './session';
import {
  createTagDiscovery,
  getObservedTechnologies,
} from '../../features/tag-discovery/model';
import {readConnectedType5Memory} from './type5ScanService';

async function acquireAndroidType5Ndef(
  tag,
  connectedTechnology,
  shouldContinue,
) {
  if (
    !getObservedTechnologies(tag).includes('NfcV') ||
    (Array.isArray(tag.ndefMessage) && tag.ndefMessage.length > 0)
  ) {
    return null;
  }
  if (connectedTechnology === NfcTech.Ndef) {
    try {
      if (!shouldContinue()) return null;
      const response = await NfcManager.ndefHandler.getNdefMessage();
      if (!shouldContinue()) return null;
      const records = response?.ndefMessage;
      return {
        source: 'android-ndef-read',
        status: Array.isArray(records) ? 'available' : 'unavailable',
        records: Array.isArray(records) ? records.slice() : [],
        response,
      };
    } catch (error) {
      if (NfcError?.UserCancel && error instanceof NfcError.UserCancel)
        throw error;
      return {
        source: 'android-ndef-read',
        status: 'unavailable',
        records: [],
        failure: {
          kind: 'native-read-error',
          message: error?.message ?? String(error),
        },
      };
    }
  }
  if (connectedTechnology === NfcTech.NfcV && shouldContinue()) {
    const evidence = await readConnectedType5Memory(tag, {
      platform: 'android',
      shouldContinue,
    });
    if (evidence?.cancelled) {
      // Preserve the shared Home cancellation contract: no stale navigation.
      throw new NfcError.UserCancel();
    }
    const available = ['decoded', 'empty'].includes(evidence?.ndef?.status);
    return {
      source: 'type5-raw-read',
      status: available ? 'available' : 'unavailable',
      records: available ? evidence.ndef.records.slice() : [],
      evidence,
    };
  }
  return null;
}

async function exploreTag({shouldContinue = () => true} = {}) {
  if (!shouldContinue()) {
    return null;
  }
  const platform = Platform.OS;
  const translate = sessionTranslator();
  const result = await runNfcSession({
    technology:
      platform === 'ios'
        ? [
            NfcTech.MifareIOS,
            NfcTech.IsoDep,
            NfcTech.Iso15693IOS,
            NfcTech.FelicaIOS,
          ]
        : [
            NfcTech.Ndef,
            NfcTech.NfcA,
            NfcTech.NfcB,
            NfcTech.NfcF,
            NfcTech.NfcV,
            NfcTech.IsoDep,
          ],
    silent: true,
    successMessage: '',
    operation: async (connectedTechnology) => {
      if (!shouldContinue()) {
        return null;
      }
      const tag = await NfcManager.getTag();
      if (!shouldContinue() || !tag) {
        return null;
      }
      const acquisition =
        platform === 'android'
          ? await acquireAndroidType5Ndef(
              tag,
              connectedTechnology,
              shouldContinue,
            )
          : null;
      if (!shouldContinue()) return null;
      return {tag, discovery: createTagDiscovery(tag, platform, acquisition)};
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
