import * as React from 'react';
import {Appbar} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SaveRecordModal from './SaveRecordModal';
import * as AppContext from '../AppContext';

function ScreenHeader(props) {
  const {navigation, title, getRecordPayload} = props;
  const [saveModalVisible, setSaveModalVisible] = React.useState(false);

  async function onPersistRecord(name) {
    const payload = getRecordPayload();
    const nextList = AppContext.Actions.getStorage();
    nextList.push({
      name,
      payload,
    });
    await AppContext.Actions.setStorage(nextList);
    setSaveModalVisible(false);
  }

  return (
    <>
      <Appbar.Header style={{backgroundColor: 'white'}}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={title} />
        {!!getRecordPayload && (
          <Appbar.Action
            icon={() => <Icon name="save" size={22} />}
            onPress={() => setSaveModalVisible(true)}
          />
        )}
      </Appbar.Header>

      <SaveRecordModal
        visible={saveModalVisible}
        onClose={() => setSaveModalVisible(false)}
        onPersistRecord={onPersistRecord}
      />
    </>
  );
}

export default ScreenHeader;
