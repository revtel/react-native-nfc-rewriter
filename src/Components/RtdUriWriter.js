import * as React from 'react';
import {View, Alert} from 'react-native';
import {Menu, TextInput, Button} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function RtdUriWriter(props, ref) {
  const [value, setValue] = React.useState(props.value?.value || '');
  const [prefix, setPrefix] = React.useState(props.value?.prefix || 'https://');
  const [showMenu, setShowMenu] = React.useState(false);
  const inputRef = React.useRef();

  if (ref) {
    ref.current = {
      getValue: () => ({value, prefix}),
    };
  }

  const writeNdef = async () => {
    inputRef.current && inputRef.current.blur();

    if (!value) {
      return;
    }

    let url = value;
    if (prefix !== '---') {
      url = prefix + value;
    }

    await NfcProxy.writeNdef({type: 'URI', value: url});
  };

  return (
    <View>
      <View style={{flexDirection: 'row', marginBottom: 10}}>
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
        <View style={{flex: 1}} />
      </View>

      <TextInput
        ref={inputRef}
        mode="outlined"
        label="URI"
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

export default React.forwardRef(RtdUriWriter);
