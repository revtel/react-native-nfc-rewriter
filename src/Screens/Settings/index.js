import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
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
import {Appbar, List, Button} from 'react-native-paper';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {LanguageContext} from '../../i18n/LanguageProvider';
import {useVisualTheme} from '../../visual/theme';
import {version} from '../../../package.json';

function LanguageChoice({value, label, selected, onSelect}) {
  const renderIcon = React.useCallback(
    (iconProps) => (
      <List.Icon
        {...iconProps}
        icon={selected ? 'radiobox-marked' : 'radiobox-blank'}
      />
    ),
    [selected],
  );
  return (
    <List.Item
      title={label}
      accessibilityRole="radio"
      accessibilityState={{checked: selected}}
      onPress={() => onSelect(value)}
      right={renderIcon}
    />
  );
}

function SettingsScreen(props) {
  useTranslation();
  const {mode, selectLanguage} = React.useContext(LanguageContext);
  const {colors} = useVisualTheme();
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
    <>
      <Appbar.Header style={{backgroundColor: colors.surface}}>
        <Appbar.BackAction onPress={() => props.navigation.goBack()} />
        <Text
          style={{
            marginLeft: 10,
            fontSize: 18,
            color: colors.text,
            flexShrink: 1,
          }}
        >
          {tr('About This App')}
        </Text>
      </Appbar.Header>
      <ScrollView
        style={[styles.wrapper, {backgroundColor: colors.background}]}
      >
        <View style={[styles.topBanner, {backgroundColor: colors.surface}]}>
          <Text style={{lineHeight: 22, color: colors.text}}>
            {tr(
              'NfcReWriter is an open source project built on react-native. Contributions and suggestions are welcome!',
            )}
          </Text>
        </View>
        <List.Section>
          <List.Subheader>{tr('Language')}</List.Subheader>
          {[
            ['system', tr('Follow system')],
            ['zh-Hant', '繁體中文'],
            ['en', 'English'],
            ['ja', '日本語'],
          ].map(([value, label]) => (
            <LanguageChoice
              key={value}
              value={value}
              label={label}
              selected={mode === value}
              onSelect={selectLanguage}
            />
          ))}
          {Platform.OS === 'android' && (
            <>
              <List.Item
                title={tr('NFC Status')}
                description={
                  nfcStatus === null ? '---' : nfcStatus ? tr('ON') : tr('OFF')
                }
              />
              <List.Item
                title={tr('NFC Settings')}
                description={tr('Jump to System NFC Settings')}
                onPress={() => {
                  NfcManager.goToNfcSetting();
                }}
              />
            </>
          )}
          <List.Item title={tr('Version')} description={version} />
          <List.Item
            title={tr('Repository')}
            description="https://github.com/revtel/react-native-nfc-rewriter"
            onPress={() => {
              Linking.openURL(
                'https://github.com/revtel/react-native-nfc-rewriter',
              );
            }}
          />
          <List.Subheader>{tr('Creators')}</List.Subheader>
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
            title="NFC To GO"
            left={() => (
              <Image
                source={require('../../../images/n2g_512.png')}
                style={styles.maintainerIcon}
                resizeMode="contain"
              />
            )}
            description="https://www.nfctogo.com"
            onPress={() => {
              Linking.openURL('https://www.nfctogo.com');
            }}
          />
        </List.Section>
        <Button
          mode="contained"
          style={{margin: 20}}
          onPress={() => {
            Linking.openURL('mailto:nfctogo@gmail.com');
          }}
        >
          {tr('Contact Us')}
        </Button>
      </ScrollView>
    </>
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
