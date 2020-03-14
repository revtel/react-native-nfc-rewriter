import * as React from 'react';
import { View } from 'react-native';
import NfcProxy from '../NfcProxy';
import styled from 'styled-components';
import * as Widget from '../Components/Widget';
import Popup from '../Components/PopupHexEditor';

class HomeScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      openModal: false
    }
  }

  render() {
    let {openModal} = this.state;
    let {navigation} = this.props;

    return (
      <View style={{flex: 1, padding: 20}}>
        <View style={{flex: 1, justifyContent: 'center'}}>
          <LogoImage source={require('../../images/nfc-512.png')}/>
        </View>

        <View style={{flex: 1, alignItems: 'center'}}>
          <Widget.ActionBtn
            css='width: 250px;'
            onPress={async () => {
              const tag = await NfcProxy.readTag();
              if (tag) {
                navigation.navigate('TagDetail', {tag});
              }
            }}
          >
            <Widget.ActionBtnText>Scan NFC Tag</Widget.ActionBtnText>
          </Widget.ActionBtn>


          <Widget.ActionBtn
            css='width: 250px;'
            onPress={async () => {
              // this.setState({openModal: true})
              this.ref.open();
            }}
          >
            <Widget.ActionBtnText>Scan NFC Tag</Widget.ActionBtnText>
          </Widget.ActionBtn>

          <Widget.ActionBtn
            css='width: 250px;'
            onPress={async () => {
              navigation.navigate('NdefWrite');
            }}
          >
            <Widget.ActionBtnText>Write NFC Tag</Widget.ActionBtnText>
          </Widget.ActionBtn>
        </View>

        <Popup ref={ref => (this.ref = ref)}/>
      </View>
    );
  }
}

const LogoImage = styled.Image`
  width: 200px;
  height: 200px;
  alignSelf: center;
`;

export default HomeScreen;