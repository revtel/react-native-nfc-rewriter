import React from 'react';
import {View} from 'react-native';
import {Button} from 'react-native-paper';

function HexBytePad({onByte}) {
  const [firstDigit, setFirstDigit] = React.useState('');
  const rows = [
    ['0', '1', '2', '3'],
    ['4', '5', '6', '7'],
    ['8', '9', 'A', 'B'],
    ['C', 'D', 'E', 'F'],
  ];

  function addDigit(digit) {
    if (firstDigit) {
      onByte(Number.parseInt(firstDigit + digit, 16));
      setFirstDigit('');
    } else {
      setFirstDigit(digit);
    }
  }

  return (
    <View>
      {rows.map((row, idx) => (
        <View key={idx} style={{flexDirection: 'row', padding: 10}}>
          {row.map((digit) => (
            <Button
              key={digit}
              mode={firstDigit === digit ? 'contained' : 'text'}
              style={{elevation: 0}}
              onPress={() => addDigit(digit)}>
              {digit}
            </Button>
          ))}
        </View>
      ))}
    </View>
  );
}

export default HexBytePad;
