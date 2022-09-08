import * as React from 'react';
import {View, Image, Share} from 'react-native';
import {List, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

function RecordItem(props) {
  const {record, removeIdx, goToHandler, onCopy, idx} = props;
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
              <Image
                source={require('../../../images/save_as.png')}
                style={{width: 24, height: 24}}
                resizeMode="contain"
              />
            )}
            onPress={() => onCopy()}
          />

          <IconButton
            icon={() => (
              <Icon name="share" size={22} style={{alignSelf: 'center'}} />
            )}
            onPress={() => {
              Share.share({
                title: 'My NFC Record',
                url: `com.revteltech.nfcopenrewriter://share?data=${JSON.stringify(
                  record,
                )}`,
              });
            }}
          />

          <IconButton
            icon={() => (
              <Icon
                name="arrow-right"
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
