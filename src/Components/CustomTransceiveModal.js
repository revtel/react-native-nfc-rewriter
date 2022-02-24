import React from 'react';
import {Image, Text, View, Animated, StyleSheet, Modal} from 'react-native';
import {Button} from 'react-native-paper';

const CmdType = {
  COMMAND: 'command',
  DELAY: 'delay',
};

function HexPads(props) {
  const {addByteToCmd} = props;
  const [value, setValue] = React.useState('');
  const values = Array.from({length: 16});
  const rows = values.reduce((acc, _, idx) => {
    if (idx % 4 === 0) {
      acc.push([]);
    }

    acc[acc.length - 1].push(idx);
    return acc;
  }, []);

  function addHexChar(c) {
    if (value.length === 1) {
      addByteToCmd(parseInt(value + c, 16));
      setValue('');
    } else {
      setValue(c);
    }
  }

  return (
    <View>
      {rows.map((row, idx) => (
        <View key={idx} style={{flexDirection: 'row', padding: 10}}>
          {row.map((hex) => {
            const c = hex.toString(16).toUpperCase();
            return (
              <Button
                key={c}
                mode={value === c ? 'contained' : 'text'}
                // issue #24: force the elevation to 0 to workaround
                style={{elevation: 0}}
                onPress={() => addHexChar(c)}>
                {c}
              </Button>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function CustomTransceiveModal(props) {
  const {
    visible: _visible,
    setVisible: _setVisible,
    isEditing,
    editCommand,
  } = props;
  const [visible, setVisible] = React.useState(false);
  const animValue = React.useRef(new Animated.Value(0)).current;
  const [cmdType, setCmdType] = React.useState(CmdType.COMMAND);
  const [cmdBytes, setCmdBytes] = React.useState([]);
  const [delayMs, setDelayMs] = React.useState(100);

  React.useEffect(() => {
    if (_visible) {
      setVisible(true);
      Animated.timing(animValue, {
        duration: 300,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        duration: 200,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }
  }, [_visible, animValue]);

  React.useEffect(() => {
    if (props.cmdType && props.cmdType !== cmdType) {
      setCmdType(props.cmdType);
    }
  }, [cmdType, props.cmdType]);

  function addByteToCmd(byte) {
    setCmdBytes([...cmdBytes, byte]);
  }

  function resetValues() {
    setCmdType(CmdType.COMMAND);
    setCmdBytes([]);
    setDelayMs(100);
  }

  function doAddCommand() {
    const cmd = {};
    if (cmdType === CmdType.COMMAND) {
      editCommand({
        type: 'command',
        payload: cmdBytes,
      });
    } else if (cmdType === CmdType.DELAY) {
      editCommand({
        type: 'delay',
        payload: delayMs,
      });
    }
    resetValues();
    _setVisible(false);
  }

  function doCancel() {
    resetValues();
    _setVisible(false);
  }

  const bgAnimStyle = {
    backgroundColor: 'rgba(0,0,0,0.3)',
    opacity: animValue,
  };

  const promptAnimStyle = {
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [550, 0],
        }),
      },
    ],
  };

  return (
    <Modal transparent={true} visible={visible}>
      <View style={[styles.wrapper]}>
        <View style={{flex: 1}} />

        <Animated.View style={[styles.prompt, promptAnimStyle]}>
          {!props.cmdType && (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={{marginRight: 10}}>Type: </Text>
              {Object.values(CmdType).map((type) => (
                <Button
                  key={type}
                  mode={type === cmdType ? 'outlined' : 'text'}
                  onPress={() => setCmdType(type)}
                  style={{flex: 1}}>
                  {type}
                </Button>
              ))}
            </View>
          )}

          {cmdType === CmdType.COMMAND && (
            <View
              style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{textAlign: 'center', letterSpacing: 1.2}}>
                {cmdBytes.length === 0 && '--'}
                {cmdBytes.reduce((acc, byte, idx) => {
                  const hexChar = (
                    '00' + byte.toString(16).toUpperCase()
                  ).slice(-2);
                  const sep = idx !== 0 && idx % 8 === 0 ? '\n' : ' ';
                  return acc + hexChar + sep;
                }, '')}
              </Text>
              <View style={{flexDirection: 'row'}}>
                <Button onPress={() => setCmdBytes(cmdBytes.slice(0, -1))}>
                  Del
                </Button>
                <Button onPress={() => setCmdBytes([])}>Clr</Button>
              </View>
              <HexPads addByteToCmd={addByteToCmd} />
            </View>
          )}

          {cmdType === CmdType.DELAY && (
            <View
              style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
              {[100, 200, 300, 400, 500, 600].map((ms) => (
                <Button
                  key={ms}
                  mode={ms === delayMs ? 'outlined' : 'text'}
                  onPress={() => setDelayMs(ms)}
                  style={{margin: 5}}>
                  {ms} ms
                </Button>
              ))}
            </View>
          )}

          <View style={{flexDirection: 'row'}}>
            <Button mode="contained" onPress={doAddCommand} style={{flex: 1}}>
              {isEditing ? 'Modify' : 'Add'}
            </Button>

            <Button onPress={doCancel} style={{flex: 1}}>
              CANCEL
            </Button>
          </View>
        </Animated.View>

        <Animated.View style={[styles.promptBg, bgAnimStyle]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  promptBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  prompt: {
    height: 550,
    alignSelf: 'stretch',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 20,
    zIndex: 2,
  },
});

export default CustomTransceiveModal;
export {CmdType};
