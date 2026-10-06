import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import * as React from 'react';
import {View} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';
import {useVisualTheme} from '../visual/theme';
import NdefWriterForm from './NdefWriterForm';

const InputLabel = {
  'sms:': 'Number',
  'tel:': 'Number',
  'mailto:': 'Email',
};

function RtdUriShortcutWriter(props, ref) {
  useTranslation();
  const scheme = props.scheme;
  const [value, setValue] = React.useState(props.value?.value || '');
  const inputRef = React.useRef();
  const write = useNdefWriter('URI');
  const {colors, spacing} = useVisualTheme();

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
    await write(url);
  };

  return (
    <NdefWriterForm
      hint={tr('The shortcut prefix will be included in the record.')}
      onWrite={writeNdef}
    >
      <View style={{flexDirection: 'row', marginBottom: spacing.lg}}>
        <Button mode="outlined" disabled>
          {scheme}
        </Button>

        <View style={{flex: 1}} />
      </View>

      <TextInput
        ref={inputRef}
        mode="outlined"
        label={tr(InputLabel[scheme])}
        multiline={true}
        value={value}
        autoCapitalize={false}
        onChangeText={setValue}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />
    </NdefWriterForm>
  );
}

export default React.forwardRef(RtdUriShortcutWriter);
