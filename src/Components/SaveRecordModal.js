import React from 'react';
import {StyleSheet, View, Text, Modal} from 'react-native';
import {Button, Appbar, TextInput} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

function SaveRecordModal(props) {
  const {visible, onClose, record, onPersistRecord} = props;
  const [name, setName] = React.useState(record?.name || '');

  return (
    <Modal visible={visible} animationType="slide">
      <Appbar.Header>
        <Appbar.Action
          icon={() => <Icon name="close" size={24} />}
          onPress={onClose}
        />
        <Appbar.Content title="NEW RECORD" />
      </Appbar.Header>
      <View style={[styles.wrapper, {padding: 15, backgroundColor: 'white'}]}>
        <TextInput
          value={name}
          onChangeText={setName}
          label="Name"
          mode="outlined"
          autoFocus={true}
          style={{marginBottom: 10}}
        />
        <Button mode="contained" onPress={() => onPersistRecord(name)}>
          SAVE
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
