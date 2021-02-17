import * as React from 'react';
import {View, Image, Platform, Dimensions, StatusBar} from 'react-native';
import NfcProxy from '../NfcProxy';
import {Button} from 'react-native-paper';

function HomeScreen(props) {
  let {navigation} = props;
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
            style={{width: 250, height: 250}}
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
            <Button
              mode="contained"
              onPress={async () => {
                const ndefTag = await NfcProxy.readNdefOnce();
                console.warn('ndefTag', ndefTag);
                if (ndefTag) {
                  navigation.navigate('TagDetail', {tag: ndefTag});
                }
              }}
              style={{marginBottom: 10}}>
              READ NDEF
            </Button>
          )}

          <Button
            mode="contained"
            onPress={async () => {
              navigation.navigate('NdefTypeList');
            }}
            style={{marginBottom: 10}}>
            WRITE NDEF
          </Button>

          <Button
            mode="contained"
            onPress={async () => {
              const tag = await NfcProxy.readTag();
              if (tag) {
                navigation.navigate('TagDetail', {tag});
              }
            }}
            style={{marginBottom: 10}}>
            SCAN NFC TAG
          </Button>

          <Button
            mode="outlined"
            onPress={async () => {
              navigation.navigate('ToolKit');
            }}
            style={{marginBottom: 10}}>
            NFC Tool Kit
          </Button>
        </View>
      </View>
    </>
  );
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
