// Simulator-only screenshot entry. Never use this entry in a store build.
// Production screens render demo data; no NFC hardware communication occurs.
import 'react-native-gesture-handler';
import React from 'react';
import {AppRegistry, Settings} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NfcManager, {Ndef} from 'react-native-nfc-manager';
import App from '../../src/App.promotion';
import NfcProxy from '../../src/NfcProxy';
import {createStorage} from '../../src/Utils/Storage';
import {executeScript} from '../../src/features/nfc-script/interpreter';
import {name as appName} from '../../app.json';

const message = Ndef.encodeMessage([Ndef.textRecord('Hello NFC')]);
const bytes = Array(135 * 4).fill(0);
bytes.splice(0, 16, 0x04, 0x11, 0x22, 0xbf, 0x33, 0x44, 0x55, 0x66,
  0x44, 0x48, 0, 0, 0xe1, 0x10, 0x3e, 0);
bytes.splice(16, message.length + 3, 0x03, message.length, ...message, 0xfe);
const version = [0, 4, 4, 2, 1, 0, 0x11, 3];
const flow = {
  kind: 'nfc-script', version: 1, tech: 'NfcA',
  steps: [
    {type: 'transceive', template: '60'},
    {type: 'capture', name: 'storage', source: 'data', offset: 6, format: 'u8'},
    {type: 'if', left: 'storage', operator: '==', right: '17', then: [
      {type: 'transceive', template: '30 04'},
      {type: 'stop', outcome: 'success', message: 'Demo complete'},
    ], else: [{type: 'stop', outcome: 'failure', message: 'Unexpected tag'}]},
  ],
};
globalThis.__promotionShot = Settings.get('promotionShot') || 'scan';
globalThis.__promotionRecord = {name: 'NTAG215 demo flow', payload: flow};
NfcProxy.init = async () => true;
NfcProxy.isEnabled = async () => true;
NfcManager.getBackgroundTag = async () => null;
NfcProxy.readTag = async () => ({
  id: '04112233445566', techTypes: ['NfcA', 'Ndef'],
  ndefMessage: [{tnf: 1, type: [84], id: [], payload: [2, 101, 110, ...Array.from('Hello NFC', c => c.charCodeAt(0))]}],
});
NfcProxy.scanType2Memory = async () => ({
  status: 'complete', scope: 'full', model: 'NTAG215', pageCount: 135,
  readPages: 135, failure: null,
  pages: Array.from({length: 135}, (_, address) => ({
    address, status: 'read', bytes: bytes.slice(address * 4, address * 4 + 4),
  })),
});
NfcProxy.runNfcScript = script => executeScript(script, {
  transceive: async command => command[0] === 0x60 ? version : bytes.slice(command[1] * 4, command[1] * 4 + 16),
});

function PromotionPreview() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    async function prepare() {
      const language = Settings.get('promotionLocale') || 'en';
      await AsyncStorage.setItem('@nfc-rewriter/language', language);
      globalThis.__promotionRecord.name = {
        en: 'NTAG215 demo flow', 'zh-Hant': 'NTAG215 示範流程', ja: 'NTAG215 デモフロー',
      }[language] || 'NTAG215 demo flow';
      flow.steps[2].then[1].message = {
        en: 'Demo complete', 'zh-Hant': '示範完成', ja: 'デモ完了',
      }[language] || 'Demo complete';
      globalThis.__promotionScan = await NfcProxy.scanType2Memory();
      globalThis.__promotionTrace = await NfcProxy.runNfcScript(flow);
      await createStorage('recordList').set([
        globalThis.__promotionRecord,
        {name: 'Hello NFC', payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'Hello NFC'}},
      ]);
      setReady(true);
    }
    prepare();
  }, []);
  return ready ? <App /> : null;
}

AppRegistry.registerComponent(appName, () => PromotionPreview);
