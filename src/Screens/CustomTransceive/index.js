import React from 'react';
import {StyleSheet, View, Text, ScrollView, SafeAreaView} from 'react-native';
import {Button, Menu} from 'react-native-paper';
import CustomTransceiveModal from '../../Components/CustomTransceiveModal';
import CommandItem from './CommandItem';

function CustomTransceiveScreen(props) {
  const {nfcTech} = props.route.params;
  const [showCommandModal, setShowCommandModal] = React.useState(false);
  const [commands, setCommands] = React.useState([]);

  function deleteCommand(idx) {
    const nextCommands = [...commands];
    nextCommands.splice(idx, 1);
    setCommands(nextCommands);
  }

  return (
    <>
      <View style={styles.wrapper}>
        <Text style={{padding: 10}}>Tech / {nfcTech}</Text>
        <ScrollView style={[styles.wrapper, {padding: 10}]}>
          {commands.map((cmd, idx) => (
            <CommandItem
              cmd={cmd}
              key={idx}
              onDelete={() => deleteCommand(idx)}
            />
          ))}
        </ScrollView>

        <View style={styles.actionBar}>
          <Button
            mode="contained"
            style={{flex: 1}}
            onPress={() => setShowCommandModal(true)}>
            ADD
          </Button>
        </View>
        <SafeAreaView />
      </View>

      <CustomTransceiveModal
        visible={showCommandModal}
        setVisible={setShowCommandModal}
        addCommand={(cmd) => setCommands([...commands, cmd])}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
});

export default CustomTransceiveScreen;
