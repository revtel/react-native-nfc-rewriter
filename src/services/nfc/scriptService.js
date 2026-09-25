import NfcManager, {NfcTech} from 'react-native-nfc-manager';
import {executeScript} from '../../features/nfc-script/interpreter';
import {validateScript} from '../../features/nfc-script/model';
import {runNfcSession} from './session';

async function runNfcScript(script) {
  const errors = validateScript(script);
  if (errors.length > 0) {
    return {success: false, trace: [], variables: {}, error: errors.join('; ')};
  }
  const technology = script.tech === 'NfcA' ? NfcTech.NfcA : NfcTech.IsoDep;
  const handler =
    script.tech === 'NfcA' ? NfcManager.nfcAHandler : NfcManager.isoDepHandler;
  const session = await runNfcSession({
    technology: [technology],
    successMessage: null,
    silent: true,
    operation: () =>
      executeScript(script, {transceive: (bytes) => handler.transceive(bytes)}),
  });
  return session.success
    ? session.value
    : {
        success: false,
        trace: [],
        variables: {},
        error: session.error?.message || String(session.error),
      };
}

export {runNfcScript};
