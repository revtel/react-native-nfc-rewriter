import * as React from 'react';
import {View} from 'react-native';
import {Menu, TextInput, Button} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';
import {useVisualTheme} from '../visual/theme';
import NdefWriterForm from './NdefWriterForm';

function RtdUriWriter(props, ref) {
  const [value, setValue] = React.useState(props.value?.value || '');
  const [prefix, setPrefix] = React.useState(props.value?.prefix || 'https://');
  const [showMenu, setShowMenu] = React.useState(false);
  const inputRef = React.useRef();
  const write = useNdefWriter('URI');
  const {colors, spacing} = useVisualTheme();

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

    await write(url);
  };

  return (
    <NdefWriterForm hint="Choose a prefix, then enter the link or URI." onWrite={writeNdef}>
      <View style={{flexDirection: 'row', marginBottom: spacing.lg}}>
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
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />
    </NdefWriterForm>
  );
}

export default React.forwardRef(RtdUriWriter);
