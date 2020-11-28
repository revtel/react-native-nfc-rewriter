import * as React from 'react';
import {View, TextInput, Alert, } from 'react-native';
import {Button} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function RtdTextWriter() {
  const inputRef = React.useRef();
  const [value, setValue] = React.useState('');

  const writeNdef = async () => {
    inputRef.current && inputRef.current.blur();

    if (!value) {
      return;
    }

    let result = await NfcProxy.writeNdef({type: 'TEXT', value});
    Alert.alert(result ? 'Success' : 'Fail to write NDEF');
  };

  return (
    <View>
      <TextInput
        ref={inputRef}
        style={{
          padding: 8,
          borderRadius: 6,
          borderColor: 'grey',
          borderWidth: 1,
          marginBottom: 20,
          height: 150,
          backgroundColor: 'white',
          color: 'black',
        }}
        value={value}
        autoCapitalize={false}
        onChangeText={setValue}
      />

      <Button
        mode="contained"
        labelStyle={{fontSize: 20}}
        onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default RtdTextWriter;