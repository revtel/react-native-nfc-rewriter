import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import styled from 'styled-components';
import {AppEvents, AppEventName} from '../AppEvents';
import NfcManager, {NfcTech} from 'react-native-nfc-manager';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class NfcScanAndroid extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };

    const duration = 200;
    this.animatedValue = new Animated.Value(0);

    this._doOpen = () => {
      this.setState({open: true}, async () => {
        await delay(100);

        Animated.timing(this.animatedValue, {
          toValue: 1,
          duration,
        }).start();
      });
    };

    this._doClose = () => {
      Animated.timing(this.animatedValue, {
        toValue: 0,
        duration,
      }).start(async () => {
        await delay(100);

        NfcManager.cancelTechnologyRequest().catch(() => 0);

        this.setState({open: false});
      });
    };
  }

  componentDidMount() {
    AppEvents.get(AppEventName.NFC_SCAN_UI).subscribe(event => {
      if (event === 'OPEN') {
        this._doOpen();
      } else {
        this._doClose();
      }
    });
  }

  render() {
    let {open} = this.state;

    if (open) {
      return (
        <Modal transparent>
          <View style={{flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)'}}>
            <Animated.View
              style={{
                position: 'absolute',
                left: 30,
                bottom: this.animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-600, 0],
                }),
                width: Dimensions.get('window').width - 60,
                height: 300,
                padding: 20,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
              }}>

              <Text style={{fontSize: 24}}>Read to scan</Text>

              <Text style={{fontSize: 20, marginBottom: 10}}>
                Please tap your inigma card
              </Text>

              <TouchableOpacity
                style={{
                  padding: 15,
                  borderRadius: 10,
                  backgroundColor: '#aaa',
                  width: 200,
                }}
                onPress={this._doClose}>
                <Text style={{textAlign: 'center', fontSize: 20}}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      );
    }

    return null;
  }
}

const Logo = styled.Image`
  width: 200px;
  height: 80px;
  resize-mode: contain;
  margin: 10px;
`;

export default NfcScanAndroid;
