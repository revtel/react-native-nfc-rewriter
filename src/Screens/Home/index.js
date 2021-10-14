import * as React from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
  StatusBar,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import NfcProxy from '../../NfcProxy';
import NfcManager, {NfcEvents, NfcTech} from 'react-native-nfc-manager';
import {Button, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import qs from 'query-string';

function HomeScreen(props) {
  const {navigation} = props;
  const [supported, setSupported] = React.useState(null);
  const [enabled, setEnabled] = React.useState(null);
  const padding = 40;
  const width = Dimensions.get('window').width - 2 * padding;

  React.useEffect(() => {
    async function initNfc() {
      try {
        const success = await NfcProxy.init();
        setSupported(success);
        setEnabled(await NfcProxy.isEnabled());

        if (success) {
          function onBackgroundTag(bgTag) {
            navigation.navigate('TagDetail', {tag: bgTag});
          }

          function onDeepLink(url, launch) {
            try {
              const customScheme = [
                'com.washow.nfcopenrewriter://', // android
                'com.revteltech.nfcopenrewriter://', // ios
              ].find((scheme) => {
                return scheme === url.slice(0, scheme.length);
              });

              if (!customScheme) {
                return;
              }

              const [action, query] = url.slice(customScheme.length).split('?');
              const params = qs.parse(query);
              if (action === 'share') {
                const sharedRecord = JSON.parse(params.data);
                if (sharedRecord.payload?.tech === NfcTech.Ndef) {
                  navigation.navigate('NdefWrite', {savedRecord: sharedRecord});
                } else if (sharedRecord.payload?.tech === NfcTech.NfcA) {
                  navigation.navigate('CustomTransceive', {
                    savedRecord: sharedRecord,
                  });
                } else if (sharedRecord.payload?.tech === NfcTech.IsoDep) {
                  navigation.navigate('CustomTransceive', {
                    savedRecord: sharedRecord,
                  });
                } else {
                  console.warn('unrecognized share payload tech');
                }
              }
            } catch (ex) {
              console.warn('fail to parse deep link', ex);
            }
          }

          // get the initial launching tag
          const bgTag = await NfcManager.getBackgroundTag();
          if (bgTag) {
            onBackgroundTag(bgTag);
          } else {
            const link = await Linking.getInitialURL();
            if (link) {
              onDeepLink(link, true);
            }
          }

          // listen to other background tags after the app launched
          NfcManager.setEventListener(
            NfcEvents.DiscoverBackgroundTag,
            onBackgroundTag,
          );

          Linking.addEventListener('url', (event) => {
            if (event.url) {
              onDeepLink(event.url, false);
            }
          });
        }
      } catch (ex) {
        console.warn(ex);
        Alert.alert('ERROR', 'fail to init NFC', [{text: 'OK'}]);
      }
    }

    initNfc();
  }, [navigation]);

  function renderNfcButtons() {
    return (
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
    );
  }

  function renderNfcNotEnabled() {
    return (
      <View
        style={{
          flex: 2,
          alignItems: 'stretch',
          alignSelf: 'center',
          width,
        }}>
        <Text style={{textAlign: 'center', marginBottom: 10}}>
          Your NFC is not enabled. Please first enable it and hit CHECK AGAIN
          button
        </Text>

        <Button
          mode="contained"
          onPress={() => NfcProxy.goToNfcSetting()}
          style={{marginBottom: 10}}>
          GO TO NFC SETTINGS
        </Button>

        <Button
          mode="outlined"
          onPress={async () => {
            setEnabled(await NfcProxy.isEnabled());
          }}>
          CHECK AGAIN
        </Button>
      </View>
    );
  }

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
            source={require('../../../images/nfc-rewriter-icon.png')}
            style={{width: 250, height: 250}}
            resizeMode="contain"
          />
        </View>

        {supported && !enabled && renderNfcNotEnabled()}

        {supported && enabled && renderNfcButtons()}

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
