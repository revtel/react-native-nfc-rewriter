import * as React from 'react';
import {ScrollView, Alert, Platform, Text} from 'react-native';
import {Appbar, List} from 'react-native-paper';
import NfcProxy from '../../NfcProxy';
import * as NfcIcons from '../../Components/NfcIcons';
import * as Ntag424 from '../../data/ntag-424';
import * as Ntag213 from '../../data/ntag-213';
import * as Ntag215 from '../../data/ntag-215';
import * as Sic43NT from '../../data/sic-43nt';

function ToolKitScreen(props) {
  const {navigation} = props;

  return (
    <>
      <Appbar.Header style={{backgroundColor: 'white'}}>
        <Text style={{marginLeft: 10, fontSize: 24}}>NFC TOOLKIT</Text>
      </Appbar.Header>

      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        <List.Section>
          <List.Subheader>Ndef</List.Subheader>
          <List.Item
            title="Make Read Only"
            description="Make the NFC tag readonly"
            left={NfcIcons.TransceiveIcon}
            onPress={async () => {
              await NfcProxy.makeReadOnly();
            }}
          />

          {Platform.OS === 'android' && (
            <List.Item
              title="NDEF Format"
              description="NDEF format"
              left={NfcIcons.EraseIcon}
              onPress={async () => {
                await NfcProxy.formatNdefAndroid();
              }}
            />
          )}
        </List.Section>

        <List.Section>
          <List.Subheader>NfcA</List.Subheader>
          <List.Item
            title="Custom Transceive"
            description="Send custom NfcA command into your tag"
            left={NfcIcons.TransceiveIcon}
            onPress={() =>
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  nfcTech: 'NfcA',
                },
              })
            }
          />
          <List.Item
            title="Erase"
            description="Write all blocks to zero"
            left={NfcIcons.EraseIcon}
            onPress={async () => {
              await NfcProxy.eraseNfcA();
            }}
          />
          <List.Item
            title="NDEF Format"
            description="Erase and NDEF format"
            left={NfcIcons.EraseIcon}
            onPress={async () => {
              await NfcProxy.eraseNfcA({format: true});
            }}
          />
          <List.Item
            title="[NTAG2xx] Verify signature"
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
          <List.Item
            title="[NTAG213] Enable password"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Enable password protection',
                  readOnly: true,
                  savedRecord: Ntag213.enablePassword,
                },
              });
            }}
          />
          <List.Item
            title="[NTAG213] Verify password"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Verify password',
                  readOnly: true,
                  savedRecord: Ntag213.verifyPassword,
                },
              });
            }}
          />
          <List.Item
            title="[NTAG215] Enable password"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Enable password protection',
                  readOnly: true,
                  savedRecord: Ntag215.enablePassword,
                },
              });
            }}
          />
          <List.Item
            title="[NTAG215] Verify password"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Verify password',
                  readOnly: true,
                  savedRecord: Ntag215.verifyPassword,
                },
              });
            }}
          />
          <List.Item
            title="[SIC43NT] Verify rolling code"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Verify rolling code',
                  readOnly: true,
                  savedRecord: Sic43NT.verifyRollingCode,
                },
              });
            }}
          />
          <List.Item
            title="[SIC43NT] Enable password"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Enable password protection',
                  readOnly: true,
                  savedRecord: Sic43NT.enablePassword,
                },
              });
            }}
          />
          <List.Item
            title="[SIC43NT] Verify password"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Verify password',
                  readOnly: true,
                  savedRecord: Sic43NT.verifyPassword,
                },
              });
            }}
          />
        </List.Section>

        <List.Section>
          <List.Subheader>NfcV</List.Subheader>
          <List.Item
            title="Custom Transceive"
            description="Send custom NfcV command into your tag"
            left={NfcIcons.TransceiveIcon}
            onPress={() =>
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  nfcTech: 'NfcV',
                },
              })
            }
          />
        </List.Section>

        <List.Section>
          <List.Subheader>IsoDep</List.Subheader>
          <List.Item
            title="Custom Transceive"
            description="Send custom APDU command into your tag"
            left={NfcIcons.TransceiveIcon}
            onPress={() =>
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  nfcTech: 'IsoDep',
                },
              })
            }
          />
          <List.Item
            title="[NTAG424 DNA] Enable temper detection"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Enable temper detection',
                  readOnly: true,
                  savedRecord: Ntag424.enableTemper,
                },
              });
            }}
          />
          <List.Item
            title="[NTAG424 DNA] Verify temper state"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Verify temper state',
                  readOnly: true,
                  savedRecord: Ntag424.verifyTemperState,
                },
              });
            }}
          />
          <List.Item
            title="[NTAG424 DNA] Verify signature"
            left={NfcIcons.TransceiveIcon}
            onPress={() => {
              navigation.navigate('Main', {
                screen: 'CustomTransceive',
                params: {
                  title: 'Verify signature',
                  readOnly: true,
                  savedRecord: Ntag424.readSignature,
                },
              });
            }}
          />
        </List.Section>

        <List.Section>
          <List.Subheader>Misc</List.Subheader>
          <List.Item
            title="Test registerTagEvent API"
            description="registerTagEvent use NDEF-only scan for iOS"
            left={NfcIcons.NfcIcon}
            onPress={async () => {
              const ndefTag = await NfcProxy.readNdefOnce();
              if (ndefTag) {
                navigation.navigate('Main', {
                  screen: 'TagDetail',
                  params: {tag: ndefTag},
                });
              }
            }}
          />
        </List.Section>
      </ScrollView>
    </>
  );
}

export default ToolKitScreen;
