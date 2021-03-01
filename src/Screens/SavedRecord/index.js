import * as React from 'react';
import {ScrollView, Alert, View} from 'react-native';
import {List, Button, IconButton} from 'react-native-paper';
import {recordListHandler} from '../../Utils/Storage';
import {NfcTech} from 'react-native-nfc-manager';
import Icon from 'react-native-vector-icons/MaterialIcons';

function SavedRecordScreen(props) {
  const {navigation} = props;
  const [recordList, setRecordList] = React.useState([]);

  React.useState(() => {
    async function loadData() {
      setRecordList(await recordListHandler.get());
    }

    loadData();
  });

  async function clearAll() {
    Alert.alert('CONFIRM', 'Are you sure?', [
      {
        text: 'DO IT',
        onPress: async () => {
          await recordListHandler.set([]);
        },
      },
      {
        text: 'CANCEL',
        onPress: () => 0,
      },
    ]);
    await recordListHandler.set([]);
  }

  const ndefRecords = recordList.filter(
    (record) => record.payload?.tech === NfcTech.Ndef,
  );

  return (
    <>
      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        <List.Section>
          <List.Subheader>NDEF ({ndefRecords.length})</List.Subheader>
          {ndefRecords.map((record) => (
            <List.Item
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
                    onPress={() => console.warn('delete')}
                  />
                  <IconButton
                    icon={() => (
                      <Icon
                        name="arrow-forward"
                        size={22}
                        style={{alignSelf: 'center'}}
                      />
                    )}
                    onPress={() => console.warn('go')}
                  />
                </View>
              )}
            />
          ))}
        </List.Section>
      </ScrollView>
      <Button onPress={clearAll}>CLEAR ALL</Button>
    </>
  );
}

export default SavedRecordScreen;
