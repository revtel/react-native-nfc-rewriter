import * as React from 'react';
import {View, Alert} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import NfcProxy from '../NfcProxy';

function VCardWriter(props, ref) {
  const [name, setName] = React.useState(props.value?.name || '');
  const [org, setOrg] = React.useState(props.value?.org || '');
  const [tel, setTel] = React.useState(props.value?.tel || '');
  const [email, setEmail] = React.useState(props.value?.email || '');

  if (ref) {
    ref.current = {
      getValue: () => ({name, org, tel, email}),
    };
  }

  const writeNdef = async () => {
    if (!name || (!tel && !email)) {
      Alert.alert(
        'Invalid Input',
        'Must provide "Name" and either "Tel" or "Email"',
      );
      return;
    }

    await NfcProxy.writeNdef({
      type: 'VCARD',
      value: {name, org, tel, email},
    });
  };

  return (
    <View>
      <TextInput
        mode="outlined"
        label="Name"
        value={name}
        onChangeText={setName}
        style={{marginBottom: 10}}
      />

      <TextInput
        mode="outlined"
        label="Org"
        value={org}
        onChangeText={setOrg}
        style={{marginBottom: 10}}
      />

      <TextInput
        mode="outlined"
        label="Tel"
        value={tel}
        onChangeText={setTel}
        style={{marginBottom: 10}}
      />

      <TextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={{marginBottom: 20}}
      />

      <Button mode="contained" labelStyle={{fontSize: 20}} onPress={writeNdef}>
        WRITE
      </Button>
    </View>
  );
}

export default React.forwardRef(VCardWriter);
