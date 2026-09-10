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
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {Button, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {parseShareDeepLink} from '../../features/home/deepLink';
import {useNfcAvailability} from '../../features/home/useNfcAvailability';
import {useTagScan} from '../../features/home/useTagScan';

function HomeScreen(props) {
  const {navigation} = props;
  const {enabled, refresh: refreshNfcAvailability} = useNfcAvailability();
  const scanTag = useTagScan(navigation);
  const padding = 40;
  const width = Dimensions.get('window').width - 2 * padding;

  React.useEffect(() => {
    async function initNfc() {
      try {
        function onBackgroundTag(bgTag) {
          navigation.navigate('Main', {
            screen: 'TagDetail',
            params: {tag: bgTag},
          });
        }

        function onDeepLink(url) {
          try {
            const target = parseShareDeepLink(url);
            if (target) {
              navigation.navigate(target.name, target.params);
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
            onDeepLink(link);
          }
        }

        // listen to other background tags after the app launched
        NfcManager.setEventListener(
          NfcEvents.DiscoverBackgroundTag,
          onBackgroundTag,
        );

        Linking.addEventListener('url', (event) => {
          if (event.url) {
            onDeepLink(event.url);
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
          onPress={scanTag}
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
          onPress={refreshNfcAvailability}>
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
