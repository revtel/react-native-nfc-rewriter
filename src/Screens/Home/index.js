import * as React from 'react';
import {
  View,
  Image,
  Dimensions,
  StatusBar,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import NfcProxy from '../../NfcProxy';
import {Button, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

function HomeScreen(props) {
  let {navigation} = props;
  const padding = 40;
  const width = Dimensions.get('window').width - 2 * padding;

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView />
      <View style={{flex: 1, padding}}>
        <View
          style={{
            flex: 3,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Image
            source={require('../../../images/nfc-512.png')}
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
          <Button
            mode="contained"
            onPress={async () => {
              const tag = await NfcProxy.readTag();
              if (tag) {
                navigation.navigate('TagDetail', {tag});
              }
            }}
            style={{marginBottom: 10}}>
            READ TAGs
          </Button>

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
              navigation.navigate('ToolKit');
            }}
            style={{marginBottom: 10}}>
            ToolKit
          </Button>

          <Button
            mode="outlined"
            onPress={async () => {
              navigation.navigate('SavedRecord');
            }}>
            MY RECORDS
          </Button>
        </View>

        <IconButton
          icon={() => <Icon name="settings" size={32} />}
          style={styles.settingIcon}
          onPress={() => {
            navigation.navigate('Settings');
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  settingIcon: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 20 : 0,
    right: 20,
  },
});

export default HomeScreen;
