import React from 'react';
import {View, Alert} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function RtdTextWriter(props, ref) {
  const inputRef = React.useRef();
  const [value, setValue] = React.useState(props.value || '');

  if (ref) {
    ref.current = {
      getValue: () => value,
    };
  }

  const writeNdef = async () => {
    inputRef.current && inputRef.current.blur();

    if (!value) {
      return;
    }

    await NfcProxy.writeNdef({type: 'TEXT', value});
  };

  return (
    <View>
      <TextInput
        ref={inputRef}
        mode="outlined"
        label="Text"
        multiline={true}
        value={value}
        autoCapitalize={false}
        onChangeText={setValue}
        style={{marginBottom: 10}}
        autoFocus={true}
      />

      <Button mode="contained" labelStyle={{fontSize: 20}} onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default React.forwardRef(RtdTextWriter);
