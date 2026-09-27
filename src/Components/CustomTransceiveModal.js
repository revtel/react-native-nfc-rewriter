import React from 'react';
import {Text, View, Animated, StyleSheet, Modal} from 'react-native';
import {Button} from 'react-native-paper';
import HexBytePad from './HexBytePad';
import {useVisualTheme} from '../visual/theme';

const CmdType = {
  COMMAND: 'command',
  DELAY: 'delay',
};

function CustomTransceiveModal(props) {
  const {colors} = useVisualTheme();
  const modalStyles = React.useMemo(() => ({
    prompt: {backgroundColor: colors.surface},
    text: {color: colors.text},
    technical: {color: colors.technical},
  }), [colors]);
  const {
    visible: _visible,
    setVisible: _setVisible,
    isEditing,
    editCommand,
    onInsertBytes,
  } = props;
  const isByteInsert = typeof onInsertBytes === 'function';
  const [visible, setVisible] = React.useState(false);
  const animValue = React.useRef(new Animated.Value(0)).current;
  const [cmdType, setCmdType] = React.useState(CmdType.COMMAND);
  const [cmdBytes, setCmdBytes] = React.useState([]);
  const [padKey, setPadKey] = React.useState(0);
  const [delayMs, setDelayMs] = React.useState(100);

  React.useEffect(() => {
    if (_visible) {
      setVisible(true);
      Animated.timing(animValue, {
        duration: 300,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      Animated.timing(animValue, {
        duration: 200,
        toValue: 0,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) {
          setVisible(false);
        }
      });
    }
  }, [_visible, animValue, visible]);

  React.useEffect(() => {
    if (props.cmdType && props.cmdType !== cmdType) {
      setCmdType(props.cmdType);
    }
  }, [cmdType, props.cmdType]);

  function addByteToCmd(byte) {
    setCmdBytes((current) => [...current, byte]);
  }

  function resetValues() {
    setCmdType(CmdType.COMMAND);
    setCmdBytes([]);
    setPadKey((current) => current + 1);
    setDelayMs(100);
  }

  function doAddCommand() {
    if (isByteInsert) {
      if (cmdBytes.length === 0) {
        return;
      }
      onInsertBytes([...cmdBytes]);
      resetValues();
      _setVisible(false);
      return;
    }
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
    <Modal transparent={true} visible={visible} onRequestClose={doCancel}>
      <View style={[styles.wrapper]}>
        <View style={{flex: 1}} />

        <Animated.View style={[styles.prompt, modalStyles.prompt, promptAnimStyle]}>
          {isByteInsert && <Text style={[styles.title, modalStyles.text]}>Add hex bytes</Text>}
          {!props.cmdType && !isByteInsert && (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={[modalStyles.text, {marginRight: 10}]}>Type: </Text>
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
              <Text style={[modalStyles.technical, {textAlign: 'center', letterSpacing: 1.2}]}>
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
              <HexBytePad key={padKey} onByte={addByteToCmd} />
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
            <Button
              mode="contained"
              onPress={doAddCommand}
              disabled={isByteInsert && cmdBytes.length === 0}
              style={{flex: 1}}>
              {isByteInsert ? 'ADD BYTES' : isEditing ? 'Modify' : 'Add'}
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
  title: {fontSize: 20, fontWeight: '700', textAlign: 'center'},
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
