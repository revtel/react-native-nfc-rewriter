import * as React from 'react';
import {TextInput} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';
import {useVisualTheme} from '../visual/theme';
import NdefWriterForm from './NdefWriterForm';

function WifiSimpleWriter(props, ref) {
  const [ssid, setSsid] = React.useState(props.value?.ssid || '');
  const [networkKey, setNetworkKey] = React.useState(
    props.value?.networkKey || '',
  );
  const write = useNdefWriter('WIFI_SIMPLE');
  const {colors, spacing} = useVisualTheme();

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
    <NdefWriterForm hint="Enter the network name and key to encode WiFi credentials." onWrite={writeNdef}>
      <TextInput
        mode="outlined"
        label="SSID"
        value={ssid}
        onChangeText={setSsid}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />

      <TextInput
        mode="outlined"
        label="Network Key"
        value={networkKey}
        onChangeText={setNetworkKey}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />
    </NdefWriterForm>
  );
}

export default React.forwardRef(WifiSimpleWriter);
