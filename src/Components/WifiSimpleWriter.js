import * as React from 'react';
import {View, Text, TextInput, Alert} from 'react-native';
import {Button} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function WifiSimpleWriter() {
  const [ssid, setSsid] = React.useState('');
  const [networkKey, setNetworkKey] = React.useState('');

  const writeNdef = async () => {
    if (!ssid || !networkKey) {
      return;
    }

    let result = await NfcProxy.writeNdef({
      type: 'WIFI_SIMPLE',
      value: {ssid, networkKey},
    });
    Alert.alert(result ? 'Success' : 'Fail to write NDEF');
  };

  return (
    <View>
      <View style={{flexDirection: 'row'}}>
        <Text style={{marginRight: 10}}>SSID</Text>
        <TextInput
          style={{
            padding: 8,
            borderRadius: 6,
            borderColor: 'grey',
            borderWidth: 1,
            marginBottom: 20,
            flex: 1,
            backgroundColor: 'white',
            color: 'black',
          }}
          value={ssid}
          onChangeText={setSsid}
        />
      </View>

      <View style={{flexDirection: 'row'}}>
        <Text style={{marginRight: 10}}>NETWORK KEY</Text>
        <TextInput
          style={{
            padding: 8,
            borderRadius: 6,
            borderColor: 'grey',
            borderWidth: 1,
            marginBottom: 20,
            flex: 1,
            backgroundColor: 'white',
            color: 'black',
          }}
          value={networkKey}
          onChangeText={setNetworkKey}
        />
      </View>

      <Button mode="contained" labelStyle={{fontSize: 20}} onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default WifiSimpleWriter;
