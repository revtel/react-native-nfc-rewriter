import * as React from 'react';
import { View, Text, TouchableOpacity, Dimensions, } from 'react-native';
import PopupModal from '../Components/PopupModal';

class PopupHexEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hexStr: ''
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

    const height = gridSize * 10 + 30;
    
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
            <Text>{hexStr}</Text>
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
            <TouchableOpacity style={styles.cell} onPress={() => this.ref && this.ref.close()}>
              <Text style={{fontSize: 20, textAlign: 'center', color: 'red'}}>CLOSE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cell} onPress={this._onBackPress}>
              <Text style={{fontSize: 20, textAlign: 'center'}}>BACK</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cell} >
              <Text style={{fontSize: 20, textAlign: 'center', color: 'blue'}}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PopupModal>
    )
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