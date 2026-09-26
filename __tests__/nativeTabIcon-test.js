import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {nativeTabIcon} from '../src/features/navigation/nativeTabIcon';

jest.mock('react-native-vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: {
    getImageSourceSync: jest.fn(() => ({uri: 'file:///tab-icon.png', scale: 3})),
  },
}));

describe('native tab icons', () => {
  beforeEach(() => {
    MaterialIcons.getImageSourceSync.mockClear();
  });

  it('provides image sources for all four Android native tabs', () => {
    const routes = ['HomeTab', 'NdefTypeListTab', 'ToolKitTab', 'MyRecordsTab'];

    routes.forEach((route) => {
      expect(nativeTabIcon(route, 'android')).toEqual({
        type: 'image',
        source: {uri: 'file:///tab-icon.png', scale: 3},
      });
    });
    expect(MaterialIcons.getImageSourceSync.mock.calls.map(([name]) => name)).toEqual([
      'nfc',
      'edit',
      'build',
      'archive',
    ]);
  });

  it('keeps SF Symbols for iOS', () => {
    expect(nativeTabIcon('HomeTab', 'ios')).toEqual({
      type: 'sfSymbol',
      name: 'waveform',
    });
    expect(MaterialIcons.getImageSourceSync).not.toHaveBeenCalled();
  });
});
