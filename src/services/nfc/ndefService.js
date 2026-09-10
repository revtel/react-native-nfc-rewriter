import NfcManager, {Ndef, NfcTech} from 'react-native-nfc-manager';
import {runNfcSession} from './session';

function encodeNdefValue(type, value) {
  if (type === 'TEXT') {
    return Ndef.encodeMessage([Ndef.textRecord(value)]);
  }
  if (type === 'URI') {
    return Ndef.encodeMessage([Ndef.uriRecord(value)]);
  }
  if (type === 'WIFI_SIMPLE') {
    return Ndef.encodeMessage([Ndef.wifiSimpleRecord(value)]);
  }
  if (type === 'VCARD') {
    const {name, tel, org, email} = value;
    const vCard = `BEGIN:VCARD\nVERSION:2.1\nN:;${name}\nORG: ${org}\nTEL;HOME:${tel}\nEMAIL:${email}\nEND:VCARD`;
    return Ndef.encodeMessage([
      Ndef.record(Ndef.TNF_MIME_MEDIA, 'text/vcard', [], vCard),
    ]);
  }
  return null;
}

async function writeNdef({type, value}) {
  const bytes = encodeNdefValue(type, value);
  if (!bytes) {
    return false;
  }
  const result = await runNfcSession({
    technology: NfcTech.Ndef,
    requestOptions: {alertMessage: 'Ready to write some NDEF'},
    operation: () => NfcManager.ndefHandler.writeNdefMessage(bytes),
  });
  return result.success;
}

async function makeReadOnly() {
  const result = await runNfcSession({
    technology: [NfcTech.Ndef],
    operation: () => NfcManager.ndefHandler.makeReadOnly(),
  });
  return result.success;
}

async function formatNdefAndroid() {
  const bytes = Ndef.encodeMessage([Ndef.textRecord('hello nfc')]);
  const result = await runNfcSession({
    technology: [NfcTech.NdefFormatable],
    operation: () => NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes),
  });
  return result.success;
}

export {encodeNdefValue, formatNdefAndroid, makeReadOnly, writeNdef};
