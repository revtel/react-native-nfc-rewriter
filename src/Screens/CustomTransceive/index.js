import React from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {Button, Menu} from 'react-native-paper';
import CustomTransceiveModal from '../../Components/CustomTransceiveModal';
import CommandItem from '../../Components/CustomCommandItem';
import NfcProxy from '../../NfcProxy';
import ScreenHeader from '../../Components/ScreenHeader';
import {NfcTech} from 'react-native-nfc-manager';

function CustomTransceiveScreen(props) {
  const {params} = props.route;
  const nfcTech = params.savedRecord?.payload.tech || params.nfcTech;
  const [showCommandModal, setShowCommandModal] = React.useState(false);
  const [commands, setCommands] = React.useState(
    params.savedRecord?.payload.value || [],
  );
  const [responses, setResponses] = React.useState([]);

  function addCommand(cmd) {
    setCommands([...commands, cmd]);
    setResponses([]);
  }

  function deleteCommand(idx) {
    const nextCommands = [...commands];
    nextCommands.splice(idx, 1);
    setCommands(nextCommands);
    setResponses([]);
  }

  async function executeCommands() {
    try {
      if (nfcTech === NfcTech.NfcA) {
        setResponses(await NfcProxy.customTransceiveNfcA(commands));
      } else if (nfcTech === NfcTech.IsoDep) {
        setResponses(await NfcProxy.customTransceiveIsoDep(commands));
      }
      Alert.alert('Commands Finished', '', [{text: 'OK', onPress: () => 0}]);
    } catch (ex) {
      Alert.alert('Not Finished', JSON.stringify(ex, null, 2), [
        {text: 'OK', onPress: () => 0},
      ]);
    }
  }

  function getRecordPayload() {
    return {
      tech: nfcTech,
      value: commands,
    };
  }

  return (
    <>
      <ScreenHeader
        title="CUSTOM TRANSCEIVE"
        navigation={props.navigation}
        getRecordPayload={getRecordPayload}
      />
      <View style={styles.wrapper}>
        <Text style={{padding: 10}}>Tech / {nfcTech}</Text>
        <ScrollView style={[styles.wrapper, {padding: 10}]}>
          {commands.map((cmd, idx) => (
            <CommandItem
              cmd={cmd}
              resp={responses[idx]}
              key={idx}
              onDelete={() => deleteCommand(idx)}
            />
          ))}
        </ScrollView>

        <View style={styles.actionBar}>
          <Button
            mode="contained"
            style={{marginBottom: 8}}
            onPress={() => setShowCommandModal(true)}>
            ADD
          </Button>
          <Button
            mode="outlined"
            disabled={commands.length === 0}
            style={{backgroundColor: 'pink'}}
            onPress={executeCommands}>
            EXECUTE
          </Button>
        </View>
        <SafeAreaView />
      </View>

      <CustomTransceiveModal
        visible={showCommandModal}
        setVisible={setShowCommandModal}
        addCommand={addCommand}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  actionBar: {
    padding: 10,
  },
});

export default CustomTransceiveScreen;
