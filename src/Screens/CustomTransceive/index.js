import React from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {Button} from 'react-native-paper';
import CustomTransceiveModal from '../../Components/CustomTransceiveModal';
import CommandItem from '../../Components/CustomCommandItem';
import NfcProxy from '../../NfcProxy';
import ScreenHeader from '../../Components/ScreenHeader';
import {NfcTech} from 'react-native-nfc-manager';

function CustomTransceiveScreen(props) {
  const {params} = props.route;
  const nfcTech = params.savedRecord?.payload.tech || params.nfcTech;
  const [showCommandModal, setShowCommandModal] = React.useState(false);
  const [currEditIdx, setCurrEditIdx] = React.useState(null);
  const [commands, setCommands] = React.useState(
    params.savedRecord?.payload.value || [],
  );
  const {readOnly, title} = params;
  const [responses, setResponses] = React.useState([]);

  React.useEffect(() => {
    if (!showCommandModal) {
      setCurrEditIdx(null);
    }
  }, [showCommandModal]);

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

  function editCommand(cmd) {
    if (currEditIdx === null) {
      return;
    }
    const nextCommands = [...commands];
    nextCommands[currEditIdx] = cmd;
    setCommands(nextCommands);
    setResponses([]);
  }

  async function executeCommands() {
    let result = [];

    if (nfcTech === NfcTech.NfcA) {
      result = await NfcProxy.customTransceiveNfcA(commands);
    } else if (nfcTech === NfcTech.IsoDep) {
      result = await NfcProxy.customTransceiveIsoDep(commands);
    }

    const [success, resps] = result;

    if (!success) {
      Alert.alert('Commands Not Finished', '', [
        {text: 'OK', onPress: () => 0},
      ]);
    }

    setResponses(resps);
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
        title={title || 'CUSTOM TRANSCEIVE'}
        navigation={props.navigation}
        getRecordPayload={getRecordPayload}
        savedRecord={params.savedRecord}
        savedRecordIdx={params.savedRecordIdx}
        readOnly={readOnly}
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
              onEdit={() => {
                setShowCommandModal(true);
                setCurrEditIdx(idx);
              }}
              readOnly={readOnly}
            />
          ))}
        </ScrollView>

        <View style={styles.actionBar}>
          {!readOnly && (
            <Button
              mode="contained"
              style={{marginBottom: 8}}
              onPress={() => setShowCommandModal(true)}>
              ADD
            </Button>
          )}

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
        isEditing={currEditIdx !== null}
        visible={showCommandModal}
        setVisible={setShowCommandModal}
        editCommand={currEditIdx === null ? addCommand : editCommand}
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
