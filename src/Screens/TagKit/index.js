import * as React from 'react';
import {ScrollView} from 'react-native';
import {List} from 'react-native-paper';
import * as NfcIcons from '../../Components/NfcIcons';
import * as Ntag424 from '../../data/ntag-424';
import * as Ntag213 from '../../data/ntag-213';
import * as Ntag215 from '../../data/ntag-215';
import * as Sic43NT from '../../data/sic-43nt';

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
          description="Verify signature"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: 'Verify signature',
              readOnly: true,
              savedRecord: Ntag424.readSignature,
            });
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
