import * as React from 'react';
import {ScrollView, Text} from 'react-native';
import {Appbar, List} from 'react-native-paper';
import {SafeAreaView} from 'react-native-screens/experimental';
import * as NfcIcons from '../../Components/NfcIcons';

function NdefTypeListScreen(props) {
  const {navigation} = props;

  return (
    <SafeAreaView edges={{bottom: true}} style={{flex: 1}}>
      <Appbar.Header style={{backgroundColor: 'white'}}>
        <Text style={{marginLeft: 10, fontSize: 24}}>WRITE NDEF</Text>
      </Appbar.Header>

      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        <List.Section>
          <List.Subheader>Well Known</List.Subheader>
          <List.Item
            title="TEXT"
            description="Write text into NFC tags"
            left={NfcIcons.TxtIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {ndefType: 'TEXT'})
            }
          />
          <List.Item
            title="Link"
            description="Write web link or uri into NFC tags"
            left={NfcIcons.UriIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {ndefType: 'URI'})
            }
          />

          <List.Item
            title="TEL"
            description="Write number into NFC tags to make phone call"
            left={NfcIcons.TelIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {
                ndefType: 'URI',
                scheme: 'tel:',
              })
            }
          />

          <List.Item
            title="SMS"
            description="Write number into NFC tags to send SMS"
            left={NfcIcons.SmsIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {
                ndefType: 'URI',
                scheme: 'sms:',
              })
            }
          />

          <List.Item
            title="EMAIL"
            description="Write email into NFC tags"
            left={NfcIcons.EmailIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {
                ndefType: 'URI',
                scheme: 'mailto:',
              })
            }
          />

          <List.Subheader>MIME</List.Subheader>
          <List.Item
            title="WiFi Simple Record"
            description="Connect to your WiFi AP"
            left={NfcIcons.WifiIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {ndefType: 'WIFI_SIMPLE'})
            }
          />

          <List.Item
            title="vCard"
            description="Write contact records. Please beaware vCard format is not supported by iOS natively"
            left={NfcIcons.ContactIcon}
            onPress={() =>
              navigation.navigate('NdefWrite', {ndefType: 'VCARD'})
            }
          />
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
}

export default NdefTypeListScreen;
