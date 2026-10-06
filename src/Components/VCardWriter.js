import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import * as React from 'react';
import {Alert} from 'react-native';
import {TextInput} from 'react-native-paper';
import {useNdefWriter} from '../features/ndef-write/useNdefWriter';
import {useVisualTheme} from '../visual/theme';
import NdefWriterForm from './NdefWriterForm';

function VCardWriter(props, ref) {
  useTranslation();
  const [name, setName] = React.useState(props.value?.name || '');
  const [org, setOrg] = React.useState(props.value?.org || '');
  const [tel, setTel] = React.useState(props.value?.tel || '');
  const [email, setEmail] = React.useState(props.value?.email || '');
  const write = useNdefWriter('VCARD');
  const {colors, spacing} = useVisualTheme();

  if (ref) {
    ref.current = {
      getValue: () => ({name, org, tel, email}),
    };
  }

  const writeNdef = async () => {
    if (!name || (!tel && !email)) {
      Alert.alert(
        tr('Invalid Input'),
        tr('Must provide "Name" and either "Tel" or "Email"'),
      );
      return;
    }

    await write({name, org, tel, email});
  };

  return (
    <NdefWriterForm
      hint={tr('A name and at least one contact method are required.')}
      onWrite={writeNdef}
    >
      <TextInput
        mode="outlined"
        label={tr('Name')}
        value={name}
        onChangeText={setName}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />

      <TextInput
        mode="outlined"
        label={tr('Org')}
        value={org}
        onChangeText={setOrg}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />

      <TextInput
        mode="outlined"
        label={tr('Tel')}
        value={tel}
        onChangeText={setTel}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />

      <TextInput
        mode="outlined"
        label={tr('Email')}
        value={email}
        onChangeText={setEmail}
        style={{marginBottom: spacing.lg, backgroundColor: colors.surface}}
      />
    </NdefWriterForm>
  );
}

export default React.forwardRef(VCardWriter);
