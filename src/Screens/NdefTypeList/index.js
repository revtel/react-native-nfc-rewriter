import * as React from 'react';
import {ScrollView, Image} from 'react-native';
import {List} from 'react-native-paper';

function NfcLogo() {
  return (
    <Image
      source={require('../../../images/nfc-512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function NdefTypeListScreen(props) {
  const {navigation} = props;

  return (
    <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
      <List.Section>
        <List.Subheader>Well Known</List.Subheader>
        <List.Item
          title="TEXT"
          description="Text description"
          left={NfcLogo}
          onPress={() => navigation.navigate('NdefWrite', {ndefType: 'TEXT'})}
        />
        <List.Item
          title="URI"
          description="URI description"
          left={NfcLogo}
          onPress={() => navigation.navigate('NdefWrite', {ndefType: 'URI'})}
        />

        <List.Item
          title="TEL"
          description="Let you call someone"
          left={NfcLogo}
          onPress={() =>
            navigation.navigate('NdefWrite', {ndefType: 'URI', scheme: 'tel:'})
          }
        />

        <List.Item
          title="SMS"
          description="Let you sms someone"
          left={NfcLogo}
          onPress={() =>
            navigation.navigate('NdefWrite', {ndefType: 'URI', scheme: 'sms:'})
          }
        />

        <List.Item
          title="EMAIL"
          description="Let you email someone"
          left={NfcLogo}
          onPress={() =>
            navigation.navigate('NdefWrite', {
              ndefType: 'URI',
              scheme: 'mailto:',
            })
          }
        />

        <List.Subheader>Utility</List.Subheader>
        <List.Item
          title="WiFi Simple Record"
          description="WiFi Simple description"
          left={NfcLogo}
          onPress={() =>
            navigation.navigate('NdefWrite', {ndefType: 'WIFI_SIMPLE'})
          }
        />
      </List.Section>
    </ScrollView>
  );
}

export default NdefTypeListScreen;
