import React from 'react';
import {Modal, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Button} from 'react-native-paper';

function VariableInsertModal({available, onClose, onInsert, visible}) {
  const [selectedName, setSelectedName] = React.useState(null);
  const [format, setFormat] = React.useState('u8');
  if (!visible) {
    return null;
  }

  const variables = Object.entries(available);
  const selectedType = available[selectedName];
  const formats = selectedType === 'bytes' ? ['bytes'] : ['u8', 'u16be', 'u16le'];
  const placeholder = selectedName
    ? '${' + selectedName + ':' + format + '}'
    : '';

  function chooseVariable(name, type) {
    setSelectedName(name);
    setFormat(type === 'bytes' ? 'bytes' : 'u8');
  }

  function close() {
    setSelectedName(null);
    setFormat('u8');
    onClose();
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <View style={styles.container}>
        <Text style={styles.title}>Insert variable</Text>
        <Text style={styles.hint}>
          Only variables available before this command are shown. Select a
          format, then add the placeholder as the next command segment.
        </Text>
        <ScrollView style={styles.list}>
          {variables.length === 0 && (
            <Text style={styles.hint}>
              No variables yet. Add a SET or CAPTURE step before this command.
            </Text>
          )}
          {variables.map(([name, type]) => (
            <Button
              key={name}
              mode={selectedName === name ? 'contained' : 'outlined'}
              style={styles.variable}
              onPress={() => chooseVariable(name, type)}>
              {`${name} · ${type === 'bytes' ? 'byte array' : 'number'}`}
            </Button>
          ))}
        </ScrollView>
        {selectedName && (
          <>
            <Text style={styles.label}>Output format</Text>
            <View style={styles.formats}>
              {formats.map((value) => (
                <Button
                  key={value}
                  compact
                  mode={format === value ? 'contained' : 'outlined'}
                  onPress={() => setFormat(value)}>
                  {value}
                </Button>
              ))}
            </View>
            <Text style={styles.preview}>{placeholder}</Text>
            <Text style={styles.hint}>
              This adds syntax, not a fixed value. The bytes are resolved
              when the script runs.
            </Text>
          </>
        )}
        <View style={styles.actions}>
          <Button onPress={close}>CANCEL</Button>
          <Button
            mode="contained"
            disabled={!selectedName}
            onPress={() => {
              onInsert(placeholder);
              close();
            }}>
            ADD VARIABLE
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA', padding: 20},
  title: {fontSize: 22, fontWeight: '700', color: '#23436A', marginBottom: 8},
  hint: {color: '#54606E', lineHeight: 20, marginBottom: 12},
  list: {flexGrow: 0, maxHeight: 300, marginBottom: 16},
  variable: {marginBottom: 8},
  label: {fontWeight: '700', color: '#23436A', marginBottom: 8},
  formats: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  preview: {
    backgroundColor: 'white',
    borderColor: '#D8E0EA',
    borderWidth: 1,
    borderRadius: 4,
    color: '#172B4D',
    fontFamily: 'monospace',
    padding: 12,
    marginVertical: 12,
  },
  actions: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 8},
});

export default VariableInsertModal;
