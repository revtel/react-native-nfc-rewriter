import {PRIMARY_TABS} from '../src/features/navigation/primaryTabs';
import materialGlyphs from 'react-native-vector-icons/glyphmaps/MaterialIcons.json';

describe('primary navigation', () => {
  it('keeps the four existing destinations and platform icon definitions', () => {
    expect(PRIMARY_TABS.map(({name, title}) => [name, title])).toEqual([
      ['HomeTab', 'SCAN TAG'],
      ['NdefTypeListTab', 'WRITE NDEF'],
      ['ToolKitTab', 'TOOLKIT'],
      ['MyRecordsTab', 'MY RECORDS'],
    ]);
    expect(PRIMARY_TABS.every(({icons}) => icons.ios && materialGlyphs[icons.android])).toBe(true);
  });
});
