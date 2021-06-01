import React from 'react';
import {
  Image,
  Linking,
  View,
  ScrollView,
  Text,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions,
  Alert,
} from 'react-native';
import {List, TextInput, Button} from 'react-native-paper';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {version} from '../../../package.json';
import {captureException} from '../../setupSentry';

const generalText = `
NfcReWriter is an open source project built on-top-of react-native. 

As an open source project, any kind of contributions and suggestions are always welcome!
`;

function SettingsScreen(props) {
  const [nfcStatus, setNfcStatus] = React.useState(null);
  const [feedback, setFeedback] = React.useState('');
  const [keyboardPadding, setKeyboardPadding] = React.useState(0);
  const scrollViewRef = React.useRef();
  const scrollPosRef = React.useRef(0);

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

  React.useEffect(() => {
    async function onKbShow() {
      const estimatedKbHeight = Dimensions.get('window').width;
      setKeyboardPadding(estimatedKbHeight);
      setTimeout(() => {
        scrollViewRef.current.scrollTo({
          y: scrollPosRef.current + estimatedKbHeight,
        });
      }, 200);
    }

    function onKbHide() {
      setKeyboardPadding(0);
    }

    if (Platform.OS === 'ios') {
      Keyboard.addListener('keyboardWillShow', onKbShow);
      Keyboard.addListener('keyboardWillHide', onKbHide);
    }

    return () => {
      if (Platform.OS === 'ios') {
        Keyboard.removeListener('keyboardWillShow', onKbShow);
        Keyboard.removeListener('keyboardWillHide', onKbHide);
      }
    };
  }, []);

  return (
    <ScrollView
      style={[styles.wrapper]}
      ref={scrollViewRef}
      onScroll={({nativeEvent}) => {
        scrollPosRef.current = nativeEvent.contentOffset.y;
      }}
      keyboardShouldPersistTaps="handled">
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
            Linking.openURL('http://www.washow.cc');
          }}
        />
      </List.Section>

      <View style={{padding: 12}}>
        <Text style={{textAlign: 'center', fontSize: 16}}>Your Feedback</Text>
        <TextInput
          style={{marginTop: 8}}
          value={feedback}
          onChangeText={setFeedback}
        />
        <Button
          mode="contained"
          style={{marginTop: 8}}
          onPress={() => {
            if (feedback) {
              captureException(new Error('Feedback'), {
                section: 'feedback',
                extra: {feedback},
              });
              Alert.alert('Thanks for your feedback');
            }
            setFeedback('');
          }}>
          SEND
        </Button>
      </View>

      {keyboardPadding > 0 && <View style={{height: keyboardPadding}} />}
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
