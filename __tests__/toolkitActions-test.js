jest.mock('../src/NfcProxy', () => ({}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {getTag: jest.fn()},
  Ndef: {uri: {decodePayload: jest.fn()}},
}));
jest.mock('../src/Components/NfcIcons', () => ({
  TransceiveIcon: 'TransceiveIcon',
  EraseIcon: 'EraseIcon',
  NfcIcon: 'NfcIcon',
}));

import {getToolkitActionGroups} from '../src/features/toolkit/actionGroups';

describe('toolkit actions', () => {
  it('keeps groups declarative and Android-only format conditional', () => {
    const navigation = {navigate: jest.fn()};
    const iosGroups = getToolkitActionGroups({
      navigation,
      nfc: {},
      platform: 'ios',
    });
    const androidGroups = getToolkitActionGroups({
      navigation,
      nfc: {},
      platform: 'android',
    });

    expect(iosGroups.map(({title}) => title)).toEqual([
      'Ndef',
      'NfcA',
      'NfcV',
      'IsoDep',
      'Misc',
    ]);
    expect(iosGroups[0].actions.map(({title}) => title)).toEqual([
      'Make Read Only',
    ]);
    expect(androidGroups[0].actions.map(({title}) => title)).toEqual([
      'Make Read Only',
      'NDEF Format',
    ]);
  });

  it('preserves custom transceive navigation', () => {
    const navigation = {navigate: jest.fn()};
    const groups = getToolkitActionGroups({navigation, nfc: {}});
    groups[1].actions[0].onPress();

    expect(navigation.navigate).toHaveBeenCalledWith('CustomTransceive', {
      nfcTech: 'NfcA',
    });
  });

  it('opens the Type 2 memory scanner from NfcA tools', () => {
    const navigation = {navigate: jest.fn()};
    const groups = getToolkitActionGroups({navigation, nfc: {}});
    const action = groups[1].actions.find(
      ({title}) => title === 'Type 2 Memory Scan',
    );

    action.onPress();
    expect(navigation.navigate).toHaveBeenCalledWith(
      'Ntag21xMemoryScan',
      undefined,
    );
  });

  it('offers a flow script for NFC-A and ISO-DEP', () => {
    const navigation = {navigate: jest.fn()};
    const groups = getToolkitActionGroups({navigation, nfc: {}});
    for (const [groupIndex, tech] of [
      [1, 'NfcA'],
      [3, 'IsoDep'],
    ]) {
      const action = groups[groupIndex].actions.find(
        ({title}) => title === 'Flow Script',
      );
      action.onPress();
      expect(navigation.navigate).toHaveBeenLastCalledWith('NfcScriptEditor', {
        nfcTech: tech,
      });
    }
  });

  it('opens the ISO15693 inspector without starting RF or adding an NFC-V script', () => {
    const navigation = {navigate: jest.fn()};
    const nfc = {scanType5Memory: jest.fn()};
    const groups = getToolkitActionGroups({navigation, nfc});
    const actions = groups.find(({title}) => title === 'NfcV').actions;
    actions
      .find(({title}) => title === 'ISO 15693 / NFC-V Inspector')
      .onPress();
    expect(navigation.navigate).toHaveBeenCalledWith(
      'Type5MemoryScan',
      undefined,
    );
    expect(nfc.scanType5Memory).not.toHaveBeenCalled();
    expect(actions.some(({title}) => title === 'Flow Script')).toBe(false);
  });
});
