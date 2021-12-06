import NfcProxy from '../NfcProxy';
import {Ndef} from 'react-native-nfc-manager';
import {Alert} from 'react-native';
import {genEnablePasswordCommands, genVerifyPasswordCommands} from './ntag-213';

const enablePassword = {
  name: 'sic43nt-enable-pass',
  ...genEnablePasswordCommands(),
};

const verifyPassword = {
  name: 'sic43nt-verify-pass',
  ...genVerifyPasswordCommands(),
};

let _prefix = null;

const verifyRollingCode = {
  name: 'sic43nt-verify-rolling-code',
  description: `Verify Rolling Code\n\nSIC43NT is a passive NFC-Forum Type 2 Tag. The response NDEF message can be automatically updated by a triggered event based on NFC field or tag tamper evident. \n\nA rolling code in the response NDEF message when there is NFC field or when the wire or trace of the tamper detection circuit has been disconnected.
The 80 bits of KEY to generate the rolling code, which default format is 3-byte “Prefix” + its 7-byte UID.`,
  payload: {
    tech: 'NfcA',
    value: [],
  },
  parameters: [{name: 'Prefix (3 bytes)', length: 3}],
  onParameterChanged: ({parameters, commands}) => {
    console.warn(parameters);
    const [prefix] = parameters;
    _prefix = [...prefix.payload];
    return commands;
  },
  onExecute: async () => {
    try {
      const tag = await NfcProxy.readTag();
      const firstNdef = tag.ndefMessage[0];
      const uri = Ndef.uri.decodePayload(firstNdef.payload);
      const [_, fullCode] = uri
        .split('?')[1]
        .split('&')
        .map((pair) => pair.split('='))
        .find((query) => query[0] === 'd');
      const uid = fullCode.slice(0, 14).toLowerCase();
      const ts = fullCode.slice(16, 16 + 8).toLowerCase();
      const code = fullCode.slice(24).toLowerCase();
      const prefix = _prefix
        .map((byte) => ('00' + byte.toString(16)).slice(-2))
        .join('');
      console.warn(uid, ts, code, prefix);
      const endpoint = `https://2j6p8l98z5.execute-api.ap-northeast-1.amazonaws.com/prod/sic4310/sign?uid=${uid}&ts=${ts}&prefix=${prefix}`;
      console.warn('endpoint', endpoint);
      const result = await (await fetch(endpoint)).json();
      console.warn('signed reuslt', result);
      if (result.sig !== code) {
        throw new Error('sig error');
      }
      Alert.alert('Rolling code match!!');
    } catch (ex) {
      console.warn(ex);
      Alert.alert("Rolling code doesn't match!!");
    }
  },
};

export {enablePassword, verifyPassword, verifyRollingCode};
