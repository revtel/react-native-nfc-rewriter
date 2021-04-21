import * as React from 'react';
import {View, Alert} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function WifiSimpleWriter(props, ref) {
  const [ssid, setSsid] = React.useState(props.value?.ssid || '');
  const [networkKey, setNetworkKey] = React.useState(
    props.value?.networkKey || '',
  );

  if (ref) {
    ref.current = {
      getValue: () => ({ssid, networkKey}),
    };
  }

  const writeNdef = async () => {
    if (!ssid || !networkKey) {
      return;
    }

    await NfcProxy.writeNdef({
      type: 'WIFI_SIMPLE',
      value: {ssid, networkKey},
    });
  };

  return (
    <View>
      <TextInput
        mode="outlined"
        label="SSID"
        value={ssid}
        onChangeText={setSsid}
        style={{marginBottom: 10}}
      />

      <TextInput
        mode="outlined"
        label="Network Key"
        value={networkKey}
        onChangeText={setNetworkKey}
        style={{marginBottom: 20}}
      />

      <Button mode="contained" labelStyle={{fontSize: 20}} onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default React.forwardRef(WifiSimpleWriter);
