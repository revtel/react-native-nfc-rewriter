import {Alert, Platform} from 'react-native';
import NfcProxy from '../../NfcProxy';
import * as NfcIcons from '../../Components/NfcIcons';
import * as Ntag424 from '../../data/ntag-424';
import * as Ntag213 from '../../data/ntag-213';
import * as Ntag215 from '../../data/ntag-215';
import * as Sic43NT from '../../data/sic-43nt';

function customTransceiveRoute(nfcTech) {
  return {
    screen: 'CustomTransceive',
    params: {nfcTech},
  };
}

function savedCommandRoute(title, savedRecord) {
  return {
    screen: 'CustomTransceive',
    params: {title, readOnly: true, savedRecord},
  };
}

async function verifyNxpSignature(nfc) {
  const tag = await nfc.readNxpSigNtag2xx();
  if (!tag) {
    return;
  }

  const sig = tag.nxpBytes.reduce((acc, byte) => {
    // eslint-disable-next-line no-bitwise
    return acc + ('0' + (byte & 0xff).toString(16)).slice(-2);
  }, '');
  if (!sig) {
    Alert.alert('Fail to obtain NXP Signature');
    return;
  }

  try {
    const response = await fetch(
      `https://badge-api.revtel2.com/badge/v2/nxp-sig-check?uid=${tag.id}&sig=${sig}`,
    );
    if (response.status === 400) {
      throw new Error('invalid-nxp-sig');
    }
    if (response.status !== 200) {
      throw new Error('unknown-nxp-sig');
    }
    await response.json();
    Alert.alert('Success', 'NXP signature is correct');
  } catch (error) {
    if (error?.message === 'invalid-nxp-sig') {
      Alert.alert('Failure', 'NXP signature is invalid');
    } else {
      Alert.alert(
        'Warning',
        'cannot verify NXP signature right now, please try again later',
      );
    }
    console.warn(error);
  }
}

function getToolkitActionGroups({
  navigation,
  nfc = NfcProxy,
  platform = Platform.OS,
}) {
  const navigate = (target) => navigation.navigate('Main', target);
  const savedAction = (title, savedRecord) => () =>
    navigate(savedCommandRoute(title, savedRecord));

  return [
    {
      title: 'Ndef',
      actions: [
        {
          title: 'Make Read Only',
          description: 'Make the NFC tag readonly',
          left: NfcIcons.TransceiveIcon,
          onPress: () => nfc.makeReadOnly(),
        },
        ...(platform === 'android'
          ? [
              {
                title: 'NDEF Format',
                description: 'NDEF format',
                left: NfcIcons.EraseIcon,
                onPress: () => nfc.formatNdefAndroid(),
              },
            ]
          : []),
      ],
    },
    {
      title: 'NfcA',
      actions: [
        {
          title: 'Custom Transceive',
          description: 'Send custom NfcA command into your tag',
          left: NfcIcons.TransceiveIcon,
          onPress: () => navigate(customTransceiveRoute('NfcA')),
        },
        {
          title: 'Erase',
          description: 'Write all blocks to zero',
          left: NfcIcons.EraseIcon,
          onPress: () => nfc.eraseNfcA(),
        },
        {
          title: 'NDEF Format',
          description: 'Erase and NDEF format',
          left: NfcIcons.EraseIcon,
          onPress: () => nfc.eraseNfcA({format: true}),
        },
        {
          title: '[NTAG2xx] Verify signature',
          left: NfcIcons.TransceiveIcon,
          onPress: () => verifyNxpSignature(nfc),
        },
        {
          title: '[NTAG213] Enable password',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction(
            'Enable password protection',
            Ntag213.enablePassword,
          ),
        },
        {
          title: '[NTAG213] Verify password',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction('Verify password', Ntag213.verifyPassword),
        },
        {
          title: '[NTAG215] Enable password',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction(
            'Enable password protection',
            Ntag215.enablePassword,
          ),
        },
        {
          title: '[NTAG215] Verify password',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction('Verify password', Ntag215.verifyPassword),
        },
        {
          title: '[SIC43NT] Verify rolling code',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction(
            'Verify rolling code',
            Sic43NT.verifyRollingCode,
          ),
        },
        {
          title: '[SIC43NT] Enable password',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction(
            'Enable password protection',
            Sic43NT.enablePassword,
          ),
        },
        {
          title: '[SIC43NT] Verify password',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction('Verify password', Sic43NT.verifyPassword),
        },
      ],
    },
    {
      title: 'NfcV',
      actions: [
        {
          title: 'Custom Transceive',
          description: 'Send custom NfcV command into your tag',
          left: NfcIcons.TransceiveIcon,
          onPress: () => navigate(customTransceiveRoute('NfcV')),
        },
      ],
    },
    {
      title: 'IsoDep',
      actions: [
        {
          title: 'Custom Transceive',
          description: 'Send custom APDU command into your tag',
          left: NfcIcons.TransceiveIcon,
          onPress: () => navigate(customTransceiveRoute('IsoDep')),
        },
        {
          title: '[NTAG424 DNA] Enable temper detection',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction(
            'Enable temper detection',
            Ntag424.enableTemper,
          ),
        },
        {
          title: '[NTAG424 DNA] Verify temper state',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction(
            'Verify temper state',
            Ntag424.verifyTemperState,
          ),
        },
        {
          title: '[NTAG424 DNA] Verify signature',
          left: NfcIcons.TransceiveIcon,
          onPress: savedAction('Verify signature', Ntag424.readSignature),
        },
      ],
    },
    {
      title: 'Misc',
      actions: [
        {
          title: 'Test registerTagEvent API',
          description: 'registerTagEvent use NDEF-only scan for iOS',
          left: NfcIcons.NfcIcon,
          onPress: async () => {
            const tag = await nfc.readNdefOnce();
            if (tag) {
              navigate({screen: 'TagDetail', params: {tag}});
            }
          },
        },
      ],
    },
  ];
}

export {getToolkitActionGroups};
