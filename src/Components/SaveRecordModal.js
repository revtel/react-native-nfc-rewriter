import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import React from 'react';
import {StyleSheet, View, Modal} from 'react-native';
import {Button, Appbar, TextInput} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useVisualTheme} from '../visual/theme';

function SaveRecordModal(props) {
  useTranslation();
  const {colors} = useVisualTheme();
  const {visible, onClose, title, onPersistRecord} = props;
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    if (!visible) {
      setName('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide">
      <Appbar.Header style={{backgroundColor: colors.surface}}>
        <Appbar.Action
          icon={() => <Icon name="close" size={24} color={colors.text} />}
          onPress={onClose}
        />
        <Appbar.Content title={title || 'SAVE RECORD'} />
      </Appbar.Header>
      <View
        style={[
          styles.wrapper,
          {padding: 15, backgroundColor: colors.background},
        ]}
      >
        <TextInput
          value={name}
          onChangeText={setName}
          label={tr('Name')}
          mode="outlined"
          autoFocus={true}
          style={{marginBottom: 10}}
        />
        <Button
          mode="contained"
          onPress={() => {
            if (name) {
              onPersistRecord(name);
            }
          }}
        >
          {tr('SAVE')}
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});

export default SaveRecordModal;
