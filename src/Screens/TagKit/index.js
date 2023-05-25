import * as React from 'react';
import {ScrollView, Alert} from 'react-native';
import {List} from 'react-native-paper';
import * as NfcIcons from '../../Components/NfcIcons';
import * as Ntag424 from '../../data/ntag-424';
import * as Ntag213 from '../../data/ntag-213';
import * as Ntag215 from '../../data/ntag-215';
import * as Sic43NT from '../../data/sic-43nt';
import NfcProxy from '../../NfcProxy';

function TagKitScreen(props) {
  const {navigation} = props;

  return (
    <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
      <List.Section>
        <List.Subheader>SIC 43NT</List.Subheader>
        <List.Item
          title="Verify rolling code"
          description="Verify rolling code"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify rolling code',
              readOnly: true,
              savedRecord: Sic43NT.verifyRollingCode,
            });
          }}
        />
        <List.Item
          title="Enable password"
          description="Enable password protection"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Enable password protection',
              readOnly: true,
              savedRecord: Sic43NT.enablePassword,
            });
          }}
        />
        <List.Item
          title="Verify password"
          description="Verify password"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify password',
              readOnly: true,
              savedRecord: Sic43NT.verifyPassword,
            });
          }}
        />

        <List.Subheader>NXP NTAG 424 DNA</List.Subheader>
        <List.Item
          title="Enable temper detection"
          description="Enable temper detection function"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Enable temper detection',
              readOnly: true,
              savedRecord: Ntag424.enableTemper,
            });
          }}
        />
        <List.Item
          title="Verify temper state"
          description="Verify temper state"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify temper state',
              readOnly: true,
              savedRecord: Ntag424.verifyTemperState,
            });
          }}
        />
        <List.Item
          title="Verify signature"
          description="Check if your tag is signed by NXP"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify signature',
              readOnly: true,
              savedRecord: Ntag424.readSignature,
            });
          }}
        />

        <List.Subheader>NXP NTAG 2XX</List.Subheader>
        <List.Item
          title="Verify signature"
          description="Check if your tag is signed by NXP"
          left={NfcIcons.TransceiveIcon}
          onPress={async () => {
            async function checkNxpSig({uid, sig}) {
              const resp = await fetch(
                `https://badge-api.revtel2.com/badge/v2/nxp-sig-check?uid=${uid}&sig=${sig}`,
              );

              if (resp.status === 400) {
                throw new Error('invalid-nxp-sig');
              } else if (resp.status !== 200) {
                throw new Error('unknown-nxp-sig');
              }

              return resp.json();
            }

            const tag = await NfcProxy.readNxpSigNtag2xx();

            if (!tag) {
              return;
            }

            const uid = tag.id;
            const sig = tag.nxpBytes.reduce((acc, byte) => {
              // eslint-disable-next-line no-bitwise
              return acc + ('0' + (byte & 0xff).toString(16)).slice(-2);
            }, '');

            if (!sig) {
              Alert.alert('Fail to obtain NXP Signature');
              return;
            }

            try {
              await checkNxpSig({uid, sig});
              Alert.alert('Success', 'NXP signature is correct');
            } catch (ex) {
              if (ex?.message === 'invalid-nxp-sig') {
                Alert.alert('Failure', 'NXP signature is invalid');
              } else {
                Alert.alert(
                  'Warning',
                  'cannot verify NXP signature right now, please try again later',
                );
              }
              console.warn(ex);
            }
          }}
        />

        <List.Subheader>NXP NTAG 213</List.Subheader>
        <List.Item
          title="Enable password"
          description="Enable password protection"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Enable password protection',
              readOnly: true,
              savedRecord: Ntag213.enablePassword,
            });
          }}
        />
        <List.Item
          title="Verify password"
          description="Verify password"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify password',
              readOnly: true,
              savedRecord: Ntag213.verifyPassword,
            });
          }}
        />

        <List.Subheader>NXP NTAG 215</List.Subheader>
        <List.Item
          title="Enable password"
          description="Enable password protection"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Enable password protection',
              readOnly: true,
              savedRecord: Ntag215.enablePassword,
            });
          }}
        />
        <List.Item
          title="Verify password"
          description="Verify password"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify password',
              readOnly: true,
              savedRecord: Ntag215.verifyPassword,
            });
          }}
        />
      </List.Section>
    </ScrollView>
  );
}

export default TagKitScreen;
