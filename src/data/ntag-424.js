import {Alert} from 'react-native';
import NfcManager from 'react-native-nfc-manager';

const readSignature = {
  name: 'nxp424-read-sig',
  payload: {
    tech: 'IsoDep',
    value: [
      {
        type: 'command',
        payload: [0, 164, 4, 0, 7, 210, 118, 0, 0, 133, 1, 0],
      },
      {type: 'command', payload: [144, 60, 0, 0, 1, 0, 0]},
    ],
  },
  onPostExecute: async (result) => {
    const [success, resps] = result;
    if (success) {
      try {
        const tag = await NfcManager.getTag();
        console.warn('tag', tag);
        const sig = resps[1]
          .reduce((acc, byte) => {
            return acc + ('00' + byte.toString(16).toUpperCase()).slice(-2);
          }, '')
          .slice(0, -4);
        console.warn('ntag-424.onPostExecute sig', sig);
        console.warn('ntag-424.onPostExecute uid', tag.id);
        const endpoint = `https://2j6p8l98z5.execute-api.ap-northeast-1.amazonaws.com/prod/nxp424/verify?uid=${tag.id}&sig=${sig}`;
        console.warn('endpoint', endpoint);
        const resp = await (await fetch(endpoint)).json();
        console.warn('verify resp', resp);
        if (resp.result) {
          Alert.alert('Signature is correct');
        } else {
          Alert.alert('Signature is wrong');
        }
      } catch (ex) {
        console.warn(ex);
      }
    }
  },
};

const enableTemper = {
  name: 'nxp424-temper-enable',
  payload: {
    tech: 'IsoDep',
    value: [
      {
        type: 'command',
        payload: [0, 164, 4, 0, 7, 210, 118, 0, 0, 133, 1, 1],
      },
      {type: 'command', payload: [144, 92, 0, 0, 3, 7, 1, 14, 0]},
    ],
  },
};

const verifyTemperState = {
  name: 'nxp424-temper-detection',
  payload: {
    tech: 'IsoDep',
    value: [
      {
        type: 'command',
        payload: [0, 164, 4, 0, 7, 210, 118, 0, 0, 133, 1, 1],
      },
      {type: 'command', payload: [144, 247, 0, 0, 0]},
    ],
  },
};

export {readSignature, enableTemper, verifyTemperState};
