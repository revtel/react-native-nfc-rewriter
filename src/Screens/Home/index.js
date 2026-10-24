import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import * as React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import NfcProxy from '../../NfcProxy';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {Button, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {SafeAreaView} from 'react-native-screens/experimental';
import {parseShareDeepLink} from '../../features/home/deepLink';
import {useNfcAvailability} from '../../features/home/useNfcAvailability';
import {useTagScan} from '../../features/home/useTagScan';
import {useTagExplore} from '../../features/home/useTagExplore';
import {useTagActions} from '../../features/home/useTagActions';
import {useVisualTheme} from '../../visual/theme';

const resourceLinks = [
  {
    label: 'Github Repo (App)',
    icon: 'github',
    url: 'https://github.com/revtel/react-native-nfc-rewriter',
  },
  {
    label: 'Github Repo (Library)',
    icon: 'github',
    url: 'https://github.com/revtel/react-native-nfc-manager',
  },
  {label: 'Contact Us', icon: 'email', url: 'mailto:nfctogo@gmail.com'},
];

function HomeScreen(props) {
  useTranslation();
  const {navigation} = props;
  const {enabled, refresh: refreshNfcAvailability} = useNfcAvailability();
  const scanTag = useTagScan(navigation);
  const {explore, exploring, cancel: cancelExplore} = useTagExplore(navigation);
  const {busy, run: runTagAction} = useTagActions(navigation);
  const {colors, spacing, type, isDark} = useVisualTheme();
  const styles = React.useMemo(
    () => makeStyles(colors, spacing, type),
    [colors, spacing, type],
  );

  React.useEffect(() => {
    async function initNfc() {
      try {
        function onBackgroundTag(bgTag) {
          navigation.navigate('TagDetail', {tag: bgTag});
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
        Alert.alert(tr('ERROR'), tr('fail to init NFC'), [{text: tr('OK')}]);
      }
    }

    initNfc();
  }, [navigation]);

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView edges={{top: true, bottom: true}} style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <View style={styles.topBar}>
            <Image
              source={require('../../../images/nfc-rewriter-icon.png')}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>{tr('NFC Reader/Writer')}</Text>
            <IconButton
              icon="cog-outline"
              iconColor={colors.accent}
              accessibilityLabel={tr('Settings')}
              onPress={() => navigation.navigate('Settings')}
            />
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>{tr('SCAN TAG')}</Text>
            <Text style={styles.subtitle}>
              {tr('Hold your device near an NFC tag to read its contents.')}
            </Text>
            <View style={styles.signal} accessibilityElementsHidden>
              <Icon name="nfc" size={72} color={colors.accent} />
            </View>
            {enabled === null ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.statusText}>
                  {tr('Checking NFC status…')}
                </Text>
              </View>
            ) : enabled ? (
              <>
                <Button
                  mode="contained"
                  icon="nfc"
                  style={styles.primaryButton}
                  contentStyle={styles.buttonContent}
                  onPress={() => runTagAction(scanTag)}
                  disabled={busy || exploring}
                >
                  {tr('SCAN NFC TAG')}
                </Button>
                <Button
                  mode="outlined"
                  icon="radar"
                  style={styles.secondaryButton}
                  contentStyle={styles.buttonContent}
                  accessibilityLabel={tr('Explore Tag')}
                  loading={exploring}
                  disabled={busy || exploring}
                  onPress={() => runTagAction(explore)}
                >
                  {tr(exploring ? 'Exploring tag…' : 'Explore Tag')}
                </Button>
                <Text style={styles.statusText}>
                  {tr('Discover native tag technologies without requiring NDEF.')}
                </Text>
                {exploring && (
                  <Button
                    mode="text"
                    accessibilityLabel={tr('Cancel tag exploration')}
                    onPress={cancelExplore}
                  >
                    {tr('CANCEL')}
                  </Button>
                )}
                <Text style={styles.statusText}>{tr('NFC is enabled')}</Text>
              </>
            ) : (
              <View style={styles.recovery}>
                <Text style={styles.statusTitle}>
                  {tr('NFC is not enabled')}
                </Text>
                <Text style={styles.statusText}>
                  {tr('Enable NFC in device settings, then check again.')}
                </Text>
                <Button
                  mode="contained"
                  style={styles.primaryButton}
                  contentStyle={styles.buttonContent}
                  onPress={() => NfcProxy.goToNfcSetting()}
                >
                  {tr('GO TO NFC SETTINGS')}
                </Button>
                <Button
                  mode="outlined"
                  style={styles.secondaryButton}
                  onPress={refreshNfcAvailability}
                >
                  {tr('CHECK AGAIN')}
                </Button>
              </View>
            )}
          </View>

          <View style={styles.links}>
            <Text style={styles.sectionLabel}>{tr('PROJECT')}</Text>
            {resourceLinks.map(({label, icon, url}) => (
              <TouchableOpacity
                key={label}
                accessibilityRole="link"
                accessibilityLabel={tr(label)}
                onPress={() => Linking.openURL(url)}
                style={styles.linkRow}
              >
                <Icon name={icon} size={20} color={colors.textMuted} />
                <Text style={styles.linkText}>{tr(label)}</Text>
                <Icon name="chevron-right" size={20} color={colors.accent} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scroll: {flex: 1},
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.md,
    },
    brandIcon: {width: 40, height: 40, marginRight: spacing.md},
    brandText: {
      color: colors.text,
      fontSize: type.label,
      fontWeight: '700',
      flex: 1,
    },
    hero: {flexGrow: 1, paddingTop: spacing.xxl, paddingBottom: spacing.xl},
    title: {color: colors.text, fontSize: type.hero, fontWeight: '800'},
    subtitle: {
      color: colors.textMuted,
      fontSize: type.body,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    signal: {
      alignSelf: 'center',
      width: 144,
      height: 144,
      borderRadius: 72,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.xxl,
    },
    primaryButton: {marginTop: spacing.md},
    secondaryButton: {marginTop: spacing.md},
    buttonContent: {minHeight: 52},
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    statusTitle: {color: colors.text, fontSize: type.label, fontWeight: '700'},
    statusText: {
      color: colors.textMuted,
      fontSize: type.body,
      marginTop: spacing.sm,
    },
    recovery: {paddingTop: spacing.sm},
    links: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: type.caption,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    linkRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    linkText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: type.body,
      marginLeft: spacing.md,
    },
  });
}

export default HomeScreen;
