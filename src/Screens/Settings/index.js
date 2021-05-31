import React from 'react';
import {
  Image,
  Linking,
  View,
  ScrollView,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import {List} from 'react-native-paper';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {version} from '../../../package.json';

const generalText = `
NfcReWriter is an open source project built on-top-of react-native. 

As an open source project, any kind of contributions and suggestions are always welcome!
`;

function SettingsScreen(props) {
  const [nfcStatus, setNfcStatus] = React.useState(null);

  React.useEffect(() => {
    function onNfcStateChanged(evt = {}) {
      const {state} = evt;
      setNfcStatus(state === 'on');
    }

    async function checkNfcState() {
      setNfcStatus(await NfcManager.isEnabled());
      NfcManager.setEventListener(NfcEvents.StateChanged, onNfcStateChanged);
    }

    if (Platform.OS === 'android') {
      checkNfcState();
    }

    return () => {
      if (Platform.OS === 'android') {
        NfcManager.setEventListener(NfcEvents.StateChanged, null);
      }
    };
  }, []);

  return (
    <ScrollView style={[styles.wrapper]}>
      <View style={styles.topBanner}>
        <Text style={{lineHeight: 16}}>{generalText}</Text>
      </View>
      <List.Section>
        {Platform.OS === 'android' && (
          <>
            <List.Item
              title="NFC Status"
              description={
                nfcStatus === null ? '---' : nfcStatus ? 'ON' : 'OFF'
              }
            />
            <List.Item
              title="NFC Settings"
              description="Jump to System NFC Settings"
              onPress={() => {
                NfcManager.goToNfcSetting();
              }}
            />
          </>
        )}
        <List.Item title="Version" description={version} />
        <List.Item
          title="Repository"
          description="https://github.com/revtel/react-native-nfc-rewriter"
          onPress={() => {
            Linking.openURL(
              'https://github.com/revtel/react-native-nfc-rewriter',
            );
          }}
        />
        <List.Subheader>Creators</List.Subheader>
        <List.Item
          title="Revteltech 忻旅科技"
          left={() => (
            <Image
              source={require('../../../images/revicon_512.png')}
              style={styles.maintainerIcon}
              resizeMode="contain"
            />
          )}
          description="https://www.revtel.tech/en"
          onPress={() => {
            Linking.openURL('https://www.revtel.tech/en');
          }}
        />
        <List.Item
          title="Washow 萬象創造"
          left={() => (
            <Image
              source={require('../../../images/washow_icon.png')}
              style={styles.maintainerIcon}
              resizeMode="contain"
            />
          )}
          description="http://www.washow.cc"
          onPress={() => {
            throw new Error('Custom Error 0.0.10');
            /*
            Linking.openURL('http://www.washow.cc');
            */
          }}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  topBanner: {
    borderRadius: 6,
    margin: 10,
    paddingHorizontal: 15,
    backgroundColor: 'white',
  },
  maintainerIcon: {
    width: 54,
    height: 54,
    overflow: 'hidden',
    borderRadius: 4,
  },
});

export default SettingsScreen;
