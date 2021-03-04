import * as React from 'react';
import {View} from 'react-native';
import {List, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

function RecordItem(props) {
  const {record, removeIdx, goToHandler, idx} = props;
  return (
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
              <Icon name="delete" size={22} style={{alignSelf: 'center'}} />
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
  );
}

export default RecordItem;
