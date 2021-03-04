import * as React from 'react';
import {SafeAreaView, ScrollView, Alert} from 'react-native';
import {List, Button} from 'react-native-paper';
import {NfcTech} from 'react-native-nfc-manager';
import * as AppContext from '../../AppContext';
import RecordItem from './RecordItem';

function groupRecordByTech(records) {
  const ndefRecords = [];
  const nfcARecords = [];
  const isoDepRecords = [];
  for (let idx = 0; idx < records.length; idx++) {
    const record = records[idx];
    if (record.payload.tech === NfcTech.Ndef) {
      ndefRecords.push({record, idx});
    } else if (record.payload.tech === NfcTech.NfcA) {
      nfcARecords.push({record, idx});
    } else if (record.payload.tech === NfcTech.IsoDep) {
      isoDepRecords.push({record, idx});
    }
  }
  return {
    ndefRecords,
    nfcARecords,
    isoDepRecords,
  };
}

function SavedRecordScreen(props) {
  const {navigation} = props;
  const app = React.useContext(AppContext.Context);
  const recordList = app.state.storageCache;

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
          const nextRecordList = [...recordList];
          nextRecordList.splice(idx, 1);
          await app.actions.setStorage(nextRecordList);
        },
      },
      {
        text: 'CANCEL',
        onPress: () => 0,
      },
    ]);
  }

  function goToHandler(savedRecord) {
    if (savedRecord.payload?.tech === NfcTech.Ndef) {
      navigation.navigate('NdefWrite', {
        savedRecord,
      });
    } else if (savedRecord.payload?.tech === NfcTech.NfcA) {
      navigation.navigate('CustomTransceive', {
        savedRecord,
      });
    } else if (savedRecord.payload?.tech === NfcTech.IsoDep) {
      navigation.navigate('CustomTransceive', {
        savedRecord,
      });
    }
  }

  const {ndefRecords, nfcARecords, isoDepRecords} = groupRecordByTech(
    recordList,
  );

  return (
    <>
      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        <List.Section>
          <List.Subheader>NDEF ({ndefRecords.length})</List.Subheader>
          {ndefRecords.map(({record, idx}) => (
            <RecordItem
              key={idx}
              record={record}
              idx={idx}
              removeIdx={removeIdx}
              goToHandler={goToHandler}
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
              goToHandler={goToHandler}
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
              goToHandler={goToHandler}
            />
          ))}
        </List.Section>
      </ScrollView>
      <Button onPress={clearAll}>CLEAR ALL</Button>
      <SafeAreaView />
    </>
  );
}

export default SavedRecordScreen;
