import React from 'react';
import {View, Text} from 'react-native';
import {IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

function PrettyCommandPayloadBytes(props) {
  const {bytes: _bytes} = props;

  const rows = [];
  let bytes = [..._bytes];
  while (bytes.length > 0) {
    rows.push(bytes.slice(0, 8));
    bytes = bytes.slice(8);
  }

  return (
    <View>
      {rows.map((row, idx) => {
        return (
          <Text key={idx}>
            {row.reduce((acc, byte) => {
              return (
                acc + ('00' + byte.toString(16).toUpperCase()).slice(-2) + ' '
              );
            }, '')}
          </Text>
        );
      })}
    </View>
  );
}

function CommandItem(props) {
  const {cmd, resp, onDelete, onEdit, readOnly, onMoveUp, onMoveDown} = props;
  const wrapperStyle = {
    marginBottom: 10,
    padding: 5,
    borderRadius: 2,
    backgroundColor: 'white',
  };

  let innerElem = null;

  if (cmd.type === 'command') {
    innerElem = (
      <View style={{flex: 1}}>
        <Text style={{marginRight: 5, color: 'gray'}}>TRANSCEIVE</Text>
        <PrettyCommandPayloadBytes bytes={cmd.payload} />
        {Array.isArray(resp) && (
          <>
            <Text style={{marginRight: 5, color: 'gray'}}>RESPONSE</Text>
            <PrettyCommandPayloadBytes bytes={resp} />
          </>
        )}
      </View>
    );
  } else {
    innerElem = (
      <>
        <Text style={{marginRight: 5, color: 'gray'}}>
          {cmd.type.toUpperCase()}
        </Text>
        <Text style={{flex: 1}}>{cmd.payload}</Text>
      </>
    );
  }

  return (
    <View style={[wrapperStyle, {flexDirection: 'row', alignItems: 'center'}]}>
      {innerElem}

      {!readOnly && (
        <IconButton
          disabled={!onMoveUp}
          icon={() => (
            <View style={{transform: [{rotateZ: '270deg'}]}}>
              <Icon name="chevron-right" size={22} />
            </View>
          )}
          onPress={onMoveUp}
        />
      )}

      {!readOnly && (
        <IconButton
          disabled={!onMoveDown}
          icon={() => (
            <View style={{transform: [{rotateZ: '90deg'}]}}>
              <Icon name="chevron-right" size={22} />
            </View>
          )}
          onPress={onMoveDown}
        />
      )}

      {!readOnly && (
        <IconButton
          icon={() => <Icon name="pencil" size={22} />}
          onPress={onEdit}
        />
      )}

      {!readOnly && (
        <IconButton
          icon={() => <Icon name="delete" size={22} />}
          onPress={onDelete}
        />
      )}
    </View>
  );
}

export default CommandItem;
