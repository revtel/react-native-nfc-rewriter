import * as React from 'react';
import {View, Image, Platform, Dimensions, StatusBar} from 'react-native';
import NfcProxy from '../NfcProxy';
import {Button} from 'react-native-paper';

class HomeScreen extends React.Component {
  render() {
    let {navigation} = this.props;
    const padding = 40;
    const width = Dimensions.get('window').width - 2 * padding;

    return (
      <>
        <StatusBar barStyle="dark-content" />
        <View style={{flex: 1, padding}}>
          <View
            style={{
              flex: 3,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Image
              source={require('../../images/nfc-512.png')}
              style={{width, height: width}}
              resizeMode="contain"
            />
          </View>

          <View
            style={{
              flex: 2,
              alignItems: 'stretch',
              alignSelf: 'center',
              width,
            }}>
            {Platform.OS === 'ios' && (
              <ActionButton
                outlined
                onPress={async () => {
                  const ndefTag = await NfcProxy.readNdefOnce();
                  console.warn('ndefTag', ndefTag);
                  if (ndefTag) {
                    navigation.navigate('TagDetail', {tag: ndefTag});
                  }
                }}>
                READ NDEF
              </ActionButton>
            )}

            <ActionButton
              outlined
              onPress={async () => {
                navigation.navigate('NdefTypeList');
              }}>
              WRITE NDEF
            </ActionButton>

            <ActionButton
              onPress={async () => {
                const tag = await NfcProxy.readTag();
                if (tag) {
                  navigation.navigate('TagDetail', {tag});
                }
              }}>
              SCAN NFC TAG
            </ActionButton>
          </View>
        </View>
      </>
    );
  }
}

function ActionButton(props) {
  const {outlined, ...extraProps} = props;
  return (
    <Button
      mode={outlined ? 'outlined' : 'contained'}
      style={{borderRadius: 8, marginBottom: 10}}
      labelStyle={[{fontSize: 22}, outlined ? {} : {color: 'white'}]}
      {...extraProps}>
      {props.children}
    </Button>
  );
}

export default HomeScreen;
