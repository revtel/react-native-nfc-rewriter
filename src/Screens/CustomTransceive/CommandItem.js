import React from 'react';
import {View, Text} from 'react-native';
import {Button, IconButton} from 'react-native-paper';

function CommandItem(props) {
  const {cmd, onEdit, onDelete} = props;
  const wrapperStyle = {
    marginBottom: 10,
    padding: 5,
    borderRadius: 2,
    backgroundColor: 'white',
  };

  let innerElem = null;

  if (cmd.type === 'command') {
    innerElem = (
      <>
        <Text style={{marginRight: 5, color: 'gray'}}>TRANSCEIVE</Text>
        <Text style={{flex: 1}}>
          {cmd.payload.reduce((acc, byte) => {
            return (
              acc + ('00' + byte.toString(16).toUpperCase()).slice(-2) + ' '
            );
          }, '')}
        </Text>
      </>
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

      <IconButton icon="close" onPress={onDelete} />
    </View>
  );
}

export default CommandItem;
