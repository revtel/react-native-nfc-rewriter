import * as React from 'react';
import {View, Alert} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

const InputLabel = {
  'sms:': 'Number',
  'tel:': 'Number',
  'mailto:': 'Email',
};

function RtdUriShortcutWriter(props, ref) {
  const scheme = props.scheme;
  const [value, setValue] = React.useState(props.value?.value || '');
  const inputRef = React.useRef();

  if (ref) {
    ref.current = {
      getValue: () => ({value, scheme}),
    };
  }

  const writeNdef = async () => {
    inputRef.current && inputRef.current.blur();

    if (!value) {
      return;
    }

    const url = scheme + value;
    await NfcProxy.writeNdef({type: 'URI', value: url});
  };

  return (
    <View>
      <View style={{flexDirection: 'row', marginBottom: 10}}>
        <Button mode="outlined" disabled>
          {scheme}
        </Button>

        <View style={{flex: 1}} />
      </View>

      <TextInput
        ref={inputRef}
        mode="outlined"
        label={InputLabel[scheme]}
        multiline={true}
        value={value}
        autoCapitalize={false}
        onChangeText={setValue}
        style={{marginBottom: 20}}
      />

      <Button mode="contained" labelStyle={{fontSize: 20}} onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default React.forwardRef(RtdUriShortcutWriter);
