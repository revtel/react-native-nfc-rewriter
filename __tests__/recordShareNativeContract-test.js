import {Platform} from 'react-native';
import {createRecordShareContent} from '../src/features/records/shareLink';

jest.mock('react-native/Libraries/Share/NativeShareModule', () => ({
  __esModule: true,
  default: {share: jest.fn().mockResolvedValue({action: 'sharedAction'})},
}));

test('the installed React Native Android adapter delivers the complete URL to its native receiver', async () => {
  const originalPlatform = Platform.OS;
  Platform.OS = 'android';
  try {
    // eslint-disable-next-line @react-native/no-deep-imports -- This regression verifies the actual Android native boundary.
    const NativeShare = require('react-native/Libraries/Share/NativeShareModule').default;
    // Exercise the real RN transformation: mocking Share.share itself hid the original bug.
    const ActualShare = jest.requireActual('react-native/Libraries/Share/Share').default;
    const record = {name: '繁中 & #', payload: {tech: 'Ndef', value: '日本語'}};
    await ActualShare.share(createRecordShareContent(record, 'android'));
    expect(NativeShare.share).toHaveBeenCalledWith(
      {
        title: 'My NFC Record',
        message: `com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(JSON.stringify(record))}`,
      },
      undefined,
    );
  } finally {
    Platform.OS = originalPlatform;
  }
});
