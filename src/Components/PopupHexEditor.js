import * as React from 'react';
import { View, Text, TouchableOpacity, Dimensions, Clipboard, Alert } from 'react-native';
import PopupModal from '../Components/PopupModal';

class PopupHexEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hexStr: '',
    }
  }

  render() {
    const {hexStr} = this.state;
    const gridSize = 50;
    const styles = {
      row: { flexDirection: 'row', height: gridSize, width: 250 },
      cell: { flex: 1 },
      cellText: { fontSize: 24, textAlign: 'center', alignItems: 'center' }
    };

    const height = gridSize * 11 + 30;
    const hexDisplay = Array.from(hexStr).reduce((acc, ch, idx) => {
      if (idx !== 0 && idx % 2 == 0) {
        acc += ' ';
      }
      return acc + ch;
    }, '');
    
    return (
      <PopupModal
        ref={this._onRef}
        popupStyle={{height}}
      >
        <View style={{height, alignItems: 'center', justifyContent: 'center', paddingBottom: 20}}>
          <View style={{
            flexDirection: 'row', height: gridSize * 2, width: 250,
            borderRadius: 4, borderWidth: 1, borderColor: '#ccc', padding: 5, marginBottom: 20
          }}>
            <Text>{hexDisplay}</Text>
          </View>

          <View style={styles.row}>
            { ['1', '2', '3'].map(v => (
              <TouchableOpacity style={styles.cell} key={v} onPress={this._onCharPress(v)}>
                <Text style={styles.cellText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            { ['4', '5', '6'].map(v => (
              <TouchableOpacity style={styles.cell} key={v} onPress={this._onCharPress(v)}>
                <Text style={styles.cellText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            { ['7', '8', '9'].map(v => (
              <TouchableOpacity style={styles.cell} key={v} onPress={this._onCharPress(v)}>
                <Text style={styles.cellText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            { ['0', 'A', 'B'].map(v => (
              <TouchableOpacity style={styles.cell} key={v} onPress={this._onCharPress(v)}>
                <Text style={styles.cellText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            { ['C', 'D', 'E'].map(v => (
              <TouchableOpacity style={styles.cell} key={v} onPress={this._onCharPress(v)}>
                <Text style={styles.cellText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            { ['', 'F', ''].map((v, i) => (
              <TouchableOpacity style={styles.cell} key={i} onPress={this._onCharPress(v)}>
                <Text style={styles.cellText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.cell} onPress={this._onCopy}>
              <Text style={{fontSize: 20, textAlign: 'center', color: 'red'}}>COPY</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cell} onPress={this._onPaste}>
              <Text style={{fontSize: 20, textAlign: 'center'}}>PASTE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cell} onPress={this._onClear}>
              <Text style={{fontSize: 20, textAlign: 'center', color: 'blue'}}>CLEAR</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.cell} onPress={() => this.ref && this.ref.close()}>
              <Text style={{fontSize: 20, textAlign: 'center', color: 'red'}}>CLOSE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cell} onPress={this._onBackPress}>
              <Text style={{fontSize: 20, textAlign: 'center'}}>BACK</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cell} onPress={this._onSave}>
              <Text style={{fontSize: 20, textAlign: 'center', color: 'blue'}}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PopupModal>
    )
  }

  // let client code to set
  setValue = v => {
    this.setState({
      hexStr: v
    });
  }

  _onCopy = () => {
    const {hexStr} = this.state;
    Clipboard.setString(hexStr);
    Alert.alert('Content copied!');
  }

  _onPaste = async () => {
    let hexStr = await Clipboard.getString(hexStr);
    hexStr = hexStr.toUpperCase();
    for (let i = 0; i < hexStr.length; i++) {
      const code = hexStr.charCodeAt(i);    
      if (!(
        (48 <= code && code <= 57) || 
        (65 <= code && code <= 70)
      )) {
        Alert.alert('Invalid HEX format');
        return;
      }
    }

    this.setState({
      hexStr
    });
  }

  _onClear = () => {
    this.setState({hexStr: ''});
  }

  _onSave = () => {
    const {onResult} = this.props;
    const {hexStr} = this.state;
    onResult(hexStr);
    this.ref.close();
  }

  _onCharPress = v => () => {
    let {hexStr} = this.state;
    this.setState({
      hexStr: hexStr + v
    })
  }

  _onBackPress = () => {
    let {hexStr} = this.state;
    this.setState({
      hexStr: hexStr.slice(0, -1)
    })

  }

  _onRef = ref => {
    this.ref = ref;
    if (ref) {
      this.open = ref.open;
      this.close = ref.close;
    }
  }
}

export default PopupHexEditor;