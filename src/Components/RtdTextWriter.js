import React from 'react';
import {TextInput} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';
import {useVisualTheme} from '../visual/theme';
import NdefWriterForm from './NdefWriterForm';

function RtdTextWriter(props, ref) {
  const inputRef = React.useRef();
  const [value, setValue] = React.useState(props.value || '');
  const write = useNdefWriter('TEXT');
  const {colors, spacing} = useVisualTheme();

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
    <NdefWriterForm hint="Plain text is stored as an NDEF Text record." onWrite={writeNdef}>
      <TextInput
        ref={inputRef}
        mode="outlined"
        label="Text"
        multiline={true}
        value={value}
        autoCapitalize={false}
        onChangeText={setValue}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
        autoFocus={true}
      />
    </NdefWriterForm>
  );
}

export default React.forwardRef(RtdTextWriter);
