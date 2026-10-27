import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import React from 'react';
import {Alert, StyleSheet, View, Modal} from 'react-native';
import {Button, Appbar, TextInput} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useVisualTheme} from '../visual/theme';

function SaveRecordModal(props) {
  useTranslation();
  const {colors} = useVisualTheme();
  const {visible, onClose, title, onPersistRecord} = props;
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const saveLock = React.useRef(false);
  const mounted = React.useRef(true);
  const renderCloseIcon = React.useCallback(
    () => <Icon name="close" size={24} color={colors.text} />,
    [colors.text],
  );

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const close = () => {
    if (!saveLock.current) onClose();
  };
  async function persist() {
    if (!name || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      await onPersistRecord(name);
    } catch (_) {
      if (mounted.current) Alert.alert(
        tr('Could not save record'),
        tr('Saved records could not be read or saved reliably. Reload them before making changes.'),
      );
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  React.useEffect(() => {
    if (!visible) {
      setName('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <Appbar.Header style={{backgroundColor: colors.surface}}>
        <Appbar.Action
          icon={renderCloseIcon}
          onPress={close}
          disabled={saving}
        />
        <Appbar.Content title={title || tr('Save record')} />
      </Appbar.Header>
      <View
        style={[
          styles.wrapper,
          {padding: 15, backgroundColor: colors.background},
        ]}
      >
        <TextInput
          value={name}
          editable={!saving}
          onChangeText={setName}
          label={tr('Name')}
          mode="outlined"
          autoFocus={true}
          style={{marginBottom: 10}}
        />
        <Button
          mode="contained"
          disabled={!name || saving}
          loading={saving}
          onPress={persist}
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
