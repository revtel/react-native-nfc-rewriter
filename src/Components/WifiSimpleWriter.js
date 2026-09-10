import * as React from 'react';
import {View} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';

function WifiSimpleWriter(props, ref) {
  const [ssid, setSsid] = React.useState(props.value?.ssid || '');
  const [networkKey, setNetworkKey] = React.useState(
    props.value?.networkKey || '',
  );
  const write = useNdefWriter('WIFI_SIMPLE');

  if (ref) {
    ref.current = {
      getValue: () => ({ssid, networkKey}),
    };
  }

  const writeNdef = async () => {
    if (!ssid || !networkKey) {
      return;
    }

    await write({ssid, networkKey});
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
