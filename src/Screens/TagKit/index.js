import * as React from 'react';
import {ScrollView, Alert} from 'react-native';
import {List} from 'react-native-paper';
import NfcProxy from '../../NfcProxy';
import * as NfcIcons from '../../Components/NfcIcons';
import * as Ntag424 from '../../data/ntag-424';

function TagKitScreen(props) {
  const {navigation} = props;

  return (
    <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
      <List.Section>
        <List.Subheader>NXP NTAG 424 DNA</List.Subheader>
        <List.Item
          title="Enable temper detection"
          description="Enable temper detection function"
          left={NfcIcons.TransceiveIcon}
          onPress={() => {
            navigation.navigate('CustomTransceive', {
              title: "Enable temper detection",
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
              title: "Verify temper state",
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
              title: "Verify signature",
              readOnly: true,
              savedRecord: Ntag424.readSignature,
            });
          }}
        />
      </List.Section>
    </ScrollView>
  );
}

export default TagKitScreen;
