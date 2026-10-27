import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Text,
  Pressable,
} from 'react-native';
import * as AppContext from '../../AppContext';
import NfcProxy from '../../NfcProxy';
import {useVisualTheme} from '../../visual/theme';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function LandingScreen(props) {
  useTranslation();
  const app = React.useContext(AppContext.Context);
  const {colors} = useVisualTheme();
  const opacityAnimValue = React.useRef(new Animated.Value(0)).current;
  const scaleAnimValue = React.useRef(new Animated.Value(1)).current;
  const running = React.useRef(false);
  const [attempt, setAttempt] = React.useState(0);
  const [startupError, setStartupError] = React.useState(false);
  const [isNfcSupported, setIsNfcSupported] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    running.current = true;
    async function initialize() {
      if (attempt === 0) {
        Animated.timing(opacityAnimValue, {
          duration: 1000,
          toValue: 1,
          useNativeDriver: true,
        }).start();
        await delay(1000);
        if (!active) return;
        Animated.parallel([
          Animated.timing(opacityAnimValue, {
            duration: 350,
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnimValue, {
            duration: 350,
            toValue: 6,
            useNativeDriver: true,
          }),
        ]).start();
        await delay(500);
        if (!active) return;
      }
      try {
        await app.actions.initStorage();
      } catch (_) {
        // Failed records stay failed in Context. NFC reading remains usable;
        // My Records provides retry and all record mutations remain blocked.
      }
      if (!active) return;
      try {
        const success = await NfcProxy.init();
        if (!active) return;
        setIsNfcSupported(success);
        if (success) {
          props.navigation.reset({index: 0, routes: [{name: 'MainTabs'}]});
        }
      } catch (_) {
        if (active) setStartupError(true);
      } finally {
        if (active) running.current = false;
      }
    }
    initialize();
    return () => { active = false; };
  }, [app.actions, props.navigation, opacityAnimValue, scaleAnimValue, attempt]);

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Animated.Image
        source={require('../../../images/nfc-rewriter-icon.png')}
        resizeMode="contain"
        style={[
          styles.image,
          {opacity: opacityAnimValue, transform: [{scale: scaleAnimValue}]},
        ]}
      />
      {startupError ? (
        <View style={styles.error}>
          <Text accessibilityRole="alert" style={{color: colors.text}}>
            {tr('fail to init NFC')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Retry')}
            style={styles.retry}
            onPress={() => {
              if (running.current) return;
              running.current = true;
              setStartupError(false);
              setAttempt((value) => value + 1);
            }}>
            <Text style={{color: colors.accent}}>{tr('Retry')}</Text>
          </Pressable>
        </View>
      ) : isNfcSupported === false ? (
        <Text style={{fontSize: 24, padding: 20, color: colors.text}}>
          {tr("Your device doesn't support NFC")}
        </Text>
      ) : (
        <ActivityIndicator size="large" style={{marginTop: 50}} color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center'},
  image: {width: 250, height: 250, backgroundColor: 'transparent'},
  error: {padding: 20, alignItems: 'center'},
  retry: {padding: 16, minHeight: 48, marginTop: 12},
});

export default LandingScreen;
