import * as React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import PopupModal from '../Components/PopupModal';

class PopupSelector extends React.Component {
  render() {
    const {options, onSelect, itemWidth=200, itemHeight=40, padding=10, fontSize=18} = this.props;
    const height = itemHeight * (options.length + 1) + 2 * padding;
    const baseItemStyle = {
      width: itemWidth,
      height: itemHeight,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    };
    
    return (
      <PopupModal
        ref={this._onRef}
        popupStyle={{height}}
      >
        <View style={{height, alignItems: 'center', justifyContent: 'center', padding}}>
          {options.map((option, idx) => {
            let display = '---';
            if (option.label) {
              display = option.label;
            } else if (typeof option === 'string') {
              display = option;
            }

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => onSelect(option)}
                style={{
                  ...baseItemStyle,
                  borderBottomWidth: 1, 
                  borderBottomColor: 'black',
                }}
              >
                <Text style={{textAlign: 'center', fontSize}}>{display}</Text>
              </TouchableOpacity>
            )
          })}

          <TouchableOpacity
            style={{
              ...baseItemStyle,
            }}
            onPress={() => this.ref && this.ref.close()}>
            <Text style={{textAlign: 'center', color: 'grey', fontSize}}>Cancel</Text>
          </TouchableOpacity>

        </View>
      </PopupModal>
    )
  }

  _onRef = ref => {
    this.ref = ref;
    if (ref) {
      this.open = ref.open;
      this.close = ref.close;
    }
  }
}

export default PopupSelector;