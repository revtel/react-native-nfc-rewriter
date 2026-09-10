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

    expect(navigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'CustomTransceive',
      params: {nfcTech: 'NfcA'},
    });
  });
});
