import NfcManager from 'react-native-nfc-manager';
import {
  formatNdefAndroid,
  makeReadOnly,
  writeNdef,
} from './services/nfc/ndefService';
import {
  readNdefOnce,
  readNxpSigNtag2xx,
  readTag,
} from './services/nfc/tagService';
import {
  customTransceiveIsoDep,
  customTransceiveNfcA,
  customTransceiveNfcV,
  eraseNfcA,
} from './services/nfc/transceiveService';
import {scanType2Memory} from './services/nfc/type2ScanService';
import {runNfcScript} from './services/nfc/scriptService';

class ErrSuccess extends Error {}

class NfcProxy {
  async init() {
    const supported = await NfcManager.isSupported();
    if (supported) {
      await NfcManager.start();
    }
    return supported;
  }

  isEnabled = () => NfcManager.isEnabled();

  goToNfcSetting = () => NfcManager.goToNfcSetting();

  readNdefOnce = readNdefOnce;

  readTag = readTag;

  writeNdef = writeNdef;

  customTransceiveNfcA = customTransceiveNfcA;

  customTransceiveNfcV = customTransceiveNfcV;

  customTransceiveIsoDep = customTransceiveIsoDep;

  eraseNfcA = eraseNfcA;

  makeReadOnly = makeReadOnly;

  formatNdefAndroid = formatNdefAndroid;

  readNxpSigNtag2xx = readNxpSigNtag2xx;

  scanType2Memory = scanType2Memory;

  runNfcScript = runNfcScript;
}

export default new NfcProxy();
export {ErrSuccess};
