import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import styled from 'styled-components';
import {AppEvents, AppEventName} from '../AppEvents';
import NfcProxy from '../NfcProxy';
import PopupModal from './PopupModal';

class NfcScanAndroid extends React.Component {
  componentDidMount() {
    AppEvents.get(AppEventName.NFC_SCAN_UI).subscribe(event => {
      if (!this._popup) {
        console.warn('NO POPUP!!');
        return;
      }

      if (event === 'OPEN') {
        this._popup.open();
      } else {
        this._popup.close();
      }
    });
  }

  render() {
    return (
      <PopupModal 
        ref={ref => (this._popup = ref)}
        popupStyle={{height: 300}}
      >
        <View style={{alignItems: 'center', justifyContent: 'center', height: 300}}>
          <Logo source={require('../../images/nfc-512.png')} />

          <Text style={{fontSize: 20, marginBottom: 10}}>
            Please tap your NFC tag 
          </Text>

          <TouchableOpacity
            style={{
              padding: 15,
              borderRadius: 10,
              backgroundColor: '#aaa',
              width: 200,
            }}
            onPress={() => {
              NfcProxy.abort();
            }}>
            <Text style={{textAlign: 'center', fontSize: 20}}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PopupModal>
    )
  }
}

const Logo = styled.Image`
  width: 80px;
  height: 80px;
  resize-mode: contain;
  margin: 10px;
`;

export default NfcScanAndroid;
