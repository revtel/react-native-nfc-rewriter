import * as React from 'react';
import {View, TextInput, Alert} from 'react-native';
import {Menu, Button} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function RtdUriWriter() {
  const [value, setValue] = React.useState('');
  const [prefix, setPrefix] = React.useState('https://');
  const [showMenu, setShowMenu] = React.useState(false);
  const inputRef = React.useRef();

  const writeNdef = async () => {
    inputRef.current && inputRef.current.blur();

    if (!value) {
      return;
    }

    let url = value;
    if (prefix !== '---') {
      url = prefix + value;
    }

    let result = await NfcProxy.writeNdef({type: 'URI', value: url});
    Alert.alert(result ? 'Success' : 'Fail to write NDEF');
  };

  return (
    <View>
      <View style={{flexDirection: 'row', marginBottom: 20}}>
        <Menu
          visible={showMenu}
          onDismiss={() => setShowMenu(false)}
          anchor={
            <Button mode="outlined" onPress={() => setShowMenu(true)}>
              {prefix}
            </Button>
          }>
          {['https://', 'http://', '---'].map((type) => (
            <Menu.Item
              key={type}
              onPress={() => {
                setPrefix(type);
                setShowMenu(false);
              }}
              title={type}
            />
          ))}
        </Menu>

        <TextInput
          ref={inputRef}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 6,
            borderColor: 'grey',
            borderWidth: 1,
            height: 150,
            backgroundColor: 'white',
            color: 'black',
            marginLeft: 10,
          }}
          autoCapitalize={false}
          value={value}
          onChangeText={setValue}
        />
      </View>

      <Button mode="contained" labelStyle={{fontSize: 20}} onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default RtdUriWriter;