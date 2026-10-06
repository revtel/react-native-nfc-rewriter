import React from 'react';
import {ActivityIndicator, Alert, AppState, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLocales} from 'react-native-localize';
import {I18nextProvider} from 'react-i18next';
import {i18n, translateText} from './index';
import {createPreferences, resolveLanguage, normalizeMode} from './preferences';

const LanguageContext = React.createContext({
  mode: 'system',
  selectLanguage: async () => {},
});

function LanguageProvider({children}) {
  const [mode, setMode] = React.useState('system');
  const [ready, setReady] = React.useState(false);
  const modeRef = React.useRef('system');
  const preferences = React.useMemo(() => createPreferences(AsyncStorage), []);

  React.useEffect(() => {
    let active = true;
    preferences.load().then(async (savedMode) => {
      if (!active) {
        return;
      }
      modeRef.current = savedMode;
      await i18n.changeLanguage(resolveLanguage(savedMode, getLocales()));
      if (active) {
        setMode(savedMode);
        setReady(true);
      }
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && modeRef.current === 'system') {
        i18n.changeLanguage(resolveLanguage('system', getLocales()));
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [preferences]);

  async function selectLanguage(nextMode) {
    const normalized = normalizeMode(nextMode);
    modeRef.current = normalized;
    setMode(normalized);
    const write = preferences.save(normalized);
    try {
      await i18n.changeLanguage(resolveLanguage(normalized, getLocales()));
      await write;
    } catch (_) {
      Alert.alert(
        translateText('Language'),
        translateText(
          'The language could not be saved. It will apply for this session only.',
        ),
      );
    }
  }

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={{mode, selectLanguage}}>
        {ready ? (
          children
        ) : (
          <View style={{flex: 1, justifyContent: 'center'}}>
            <ActivityIndicator />
          </View>
        )}
      </LanguageContext.Provider>
    </I18nextProvider>
  );
}

export {LanguageProvider, LanguageContext};
