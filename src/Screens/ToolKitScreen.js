import * as React from 'react';
import {ScrollView, Image, Alert} from 'react-native';
import {List} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function NfcLogo() {
  return (
    <Image
      source={require('../../images/nfc-512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function ToolKitScreen(props) {
  const {navigation} = props;

  return (
    <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
      <List.Section>
        <List.Subheader>NfcA</List.Subheader>
        <List.Item
          title="Custom Transceive"
          description="Send custom NfcA command into your tag"
          left={NfcLogo}
          onPress={() =>
            navigation.navigate('CustomTransceive', {
              nfcTech: 'NfcA',
            })
          }
        />
        <List.Item
          title="Erase"
          description="Write all memory to 0"
          left={NfcLogo}
        />
        <List.Item
          title="NDEF Format"
          description="NDEF Format"
          left={NfcLogo}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>Misc</List.Subheader>
        <List.Item
          title="Test registerTagEvent API"
          description="registerTagEvent use NDEF-only scan for iOS"
          left={NfcLogo}
          onPress={async () => {
            const ndefTag = await NfcProxy.readNdefOnce();
            if (ndefTag) {
              navigation.navigate('TagDetail', {tag: ndefTag});
            }
          }}
        />
      </List.Section>
    </ScrollView>
  );
}

export default ToolKitScreen;
