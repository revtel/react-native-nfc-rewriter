import React from 'react';
import {View} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';

function RtdTextWriter(props, ref) {
  const inputRef = React.useRef();
  const [value, setValue] = React.useState(props.value || '');
  const write = useNdefWriter('TEXT');

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

    await write(value);
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
