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
  TouchableOpacity,
} from 'react-native';
import NfcProxy from '../../NfcProxy';
import NfcManager, {NfcEvents, NfcTech} from 'react-native-nfc-manager';
import {Button, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import qs from 'query-string';

function HomeScreen(props) {
  const {navigation} = props;
  const [enabled, setEnabled] = React.useState(null);
  const padding = 40;
  const width = Dimensions.get('window').width - 2 * padding;

  React.useEffect(() => {
    async function initNfc() {
      try {
        setEnabled(await NfcProxy.isEnabled());

        function onBackgroundTag(bgTag) {
          navigation.navigate('Main', {
            screen: 'TagDetail',
            params: {tag: bgTag},
          });
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

            url = url.slice(customScheme.length);

            // issue #23: we might have '?' in our payload, so we cannot simply "split" it
            let action = url;
            let query = '';
            let splitIdx = url.indexOf('?');

            if (splitIdx > -1) {
              action = url.slice(0, splitIdx);
              query = url.slice(splitIdx);
            }

            const params = qs.parse(query);
            if (action === 'share') {
              const sharedRecord = JSON.parse(params.data);
              if (sharedRecord.payload?.tech === NfcTech.Ndef) {
                navigation.navigate('Main', {
                  screen: 'NdefWrite',
                  params: {savedRecord: sharedRecord},
                });
              } else if (sharedRecord.payload?.tech === NfcTech.NfcA) {
                navigation.navigate('Main', {
                  screen: 'CustomTransceive',
                  params: {
                    savedRecord: sharedRecord,
                  },
                });
              } else if (sharedRecord.payload?.tech === NfcTech.NfcV) {
                navigation.navigate('Main', {
                  screen: 'CustomTransceive',
                  params: {
                    savedRecord: sharedRecord,
                  },
                });
              } else if (sharedRecord.payload?.tech === NfcTech.IsoDep) {
                navigation.navigate('Main', {
                  screen: 'CustomTransceive',
                  params: {
                    savedRecord: sharedRecord,
                  },
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
          console.warn('DEEP LINK', link);
          if (link) {
            onDeepLink(link, true);
          }
        }

        // listen to other background tags after the app launched
        NfcManager.setEventListener(
          NfcEvents.DiscoverBackgroundTag,
          onBackgroundTag,
        );

        // listen to the NFC on/off state on Android device
        if (Platform.OS === 'android') {
          NfcManager.setEventListener(
            NfcEvents.StateChanged,
            ({state} = {}) => {
              NfcManager.cancelTechnologyRequest().catch(() => 0);
              if (state === 'off') {
                setEnabled(false);
              } else if (state === 'on') {
                setEnabled(true);
              }
            },
          );
        }

        Linking.addEventListener('url', (event) => {
          if (event.url) {
            onDeepLink(event.url, false);
          }
        });
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
          position: 'absolute',
          left: 0,
          bottom: 0,
          right: 0,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20,
        }}>
        <Button
          mode="contained"
          onPress={async () => {
            const tag = await NfcProxy.readTag();
            if (tag) {
              navigation.navigate('Main', {screen: 'TagDetail', params: {tag}});
            }
          }}
          style={{width}}>
          SCAN NFC TAG
        </Button>
      </View>
    );
  }

  function renderNfcNotEnabled() {
    return (
      <View
        style={{
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
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Image
            source={require('../../../images/nfc-rewriter-icon.png')}
            style={{width: 250, height: 250}}
            resizeMode="contain"
          />
          <Text
            style={{
              padding: 20,
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              color: '#666',
            }}>
            Open Source NFC Reader/Writer
          </Text>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                'https://github.com/revtel/react-native-nfc-rewriter',
              )
            }
            style={{
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}>
            <Icon name="github" size={18} color={'#888'} />
            <Text style={{marginLeft: 6, color: '#888'}}>
              Github Repo (App)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                'https://github.com/revtel/react-native-nfc-manager',
              )
            }
            style={{
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}>
            <Icon name="github" size={18} color={'#888'} />
            <Text style={{marginLeft: 6, color: '#888'}}>
              Github Repo (Library)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:nfctogo@gmail.com')}
            style={{
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="email" size={18} color={'#888'} />
            <Text style={{marginLeft: 6, color: '#888'}}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        <IconButton
          icon={() => <Icon name="cog" size={32} />}
          style={styles.settingIcon}
          onPress={() => {
            navigation.navigate('Settings');
          }}
        />

        {enabled ? renderNfcButtons() : renderNfcNotEnabled()}
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
