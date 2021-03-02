import * as React from 'react';
import {SafeAreaView, ScrollView, Alert, View} from 'react-native';
import {List, Button, IconButton} from 'react-native-paper';
import {NfcTech} from 'react-native-nfc-manager';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as AppContext from '../../AppContext';

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
    }
  }

  const ndefRecords = recordList.filter(
    (record) => record.payload?.tech === NfcTech.Ndef,
  );

  return (
    <>
      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        <List.Section>
          <List.Subheader>NDEF ({ndefRecords.length})</List.Subheader>
          {ndefRecords.map((record, idx) => (
            <List.Item
              key={idx}
              title={record.name}
              right={() => (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'center',
                  }}>
                  <IconButton
                    icon={() => (
                      <Icon
                        name="delete"
                        size={22}
                        style={{alignSelf: 'center'}}
                      />
                    )}
                    onPress={() => removeIdx(idx)}
                  />
                  <IconButton
                    icon={() => (
                      <Icon
                        name="arrow-forward"
                        size={22}
                        style={{alignSelf: 'center'}}
                      />
                    )}
                    onPress={() => goToHandler(record)}
                  />
                </View>
              )}
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
