import * as React from 'react';
import {SafeAreaView, ScrollView, Alert, Text} from 'react-native';
import {Appbar, List, Button} from 'react-native-paper';
import * as AppContext from '../../AppContext';
import RecordItem from './RecordItem';
import SaveRecordModal from '../../Components/SaveRecordModal';
import {
  getRecordNavigationTarget,
  groupRecordsByTech,
} from '../../features/records/recordModel';

function SavedRecordScreen(props) {
  const {navigation} = props;
  const app = React.useContext(AppContext.Context);
  const recordList = app.state.storageCache;
  const [recordToCopy, setRecordToCopy] = React.useState(null);

  async function clearAll() {
    Alert.alert('CONFIRM', 'Are you sure?', [
      {
        text: 'DO IT',
        onPress: async () => {
          await app.actions.setStorage([]);
        },
      },
      {
        text: 'CANCEL',
        onPress: () => 0,
      },
    ]);
  }

  async function removeIdx(idx) {
    Alert.alert('CONFIRM', 'Are you sure?', [
      {
        text: 'DO IT',
        onPress: async () => {
          await app.actions.removeRecord(idx);
        },
      },
      {
        text: 'CANCEL',
        onPress: () => 0,
      },
    ]);
  }

  function goToHandler(savedRecordIdx, savedRecord) {
    const target = getRecordNavigationTarget(savedRecord, savedRecordIdx);
    if (target) {
      navigation.navigate(target.name, target.params);
    }
  }

  const {ndefRecords, nfcARecords, nfcVRecords, isoDepRecords} =
    groupRecordsByTech(recordList);

  return (
    <>
      <Appbar.Header style={{backgroundColor: 'white'}}>
        <Text style={{marginLeft: 10, fontSize: 24}}>MY RECORDS</Text>
      </Appbar.Header>
      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        <List.Section>
          <List.Subheader>NDEF ({ndefRecords.length})</List.Subheader>
          {ndefRecords.map(({record, idx}) => (
            <RecordItem
              key={idx}
              record={record}
              idx={idx}
              removeIdx={removeIdx}
              goToHandler={goToHandler.bind(null, idx)}
              onCopy={() => {
                console.warn(record);
                setRecordToCopy(record);
              }}
            />
          ))}
        </List.Section>

        <List.Section>
          <List.Subheader>NfcA ({nfcARecords.length})</List.Subheader>
          {nfcARecords.map(({record, idx}) => (
            <RecordItem
              key={idx}
              record={record}
              idx={idx}
              removeIdx={removeIdx}
              goToHandler={goToHandler.bind(null, idx)}
              onCopy={() => setRecordToCopy(record)}
            />
          ))}
        </List.Section>

        <List.Section>
          <List.Subheader>NfcV ({nfcVRecords.length})</List.Subheader>
          {nfcVRecords.map(({record, idx}) => (
            <RecordItem
              key={idx}
              record={record}
              idx={idx}
              removeIdx={removeIdx}
              goToHandler={goToHandler.bind(null, idx)}
              onCopy={() => setRecordToCopy(record)}
            />
          ))}
        </List.Section>

        <List.Section>
          <List.Subheader>IsoDep ({isoDepRecords.length})</List.Subheader>
          {isoDepRecords.map(({record, idx}) => (
            <RecordItem
              key={idx}
              record={record}
              idx={idx}
              removeIdx={removeIdx}
              goToHandler={goToHandler.bind(null, idx)}
              onCopy={() => setRecordToCopy(record)}
            />
          ))}
        </List.Section>
      </ScrollView>
      <Button onPress={clearAll}>CLEAR ALL</Button>
      <SafeAreaView />

      <SaveRecordModal
        title={'COPY THIS RECORD AS'}
        visible={!!recordToCopy}
        onClose={() => setRecordToCopy(null)}
        onPersistRecord={async (name) => {
          if (!recordToCopy) {
            return false;
          }

          await app.actions.appendRecord({
            name,
            payload: recordToCopy.payload,
          });
          setRecordToCopy(null);
        }}
      />
    </>
  );
}

export default SavedRecordScreen;
