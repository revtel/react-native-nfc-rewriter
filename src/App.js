import './AppOutlets';
import {LanguageProvider} from './i18n/LanguageProvider';
import * as React from 'react';
import {Platform, UIManager, useColorScheme} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import AppNavigator from './AppNavigator';
import * as AppContext from './AppContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {createPaperTheme} from './visual/theme';
import {cleanupAbandonedExports} from './services/records/documentService';

function ThemedApp() {
  const isDark = useColorScheme() === 'dark';
  return (
    <PaperProvider theme={createPaperTheme(isDark)}>
      <AppNavigator />
    </PaperProvider>
  );
}

class App extends React.Component {
  constructor(props) {
    super();
    // explicitly create redux store
    // enable LayoutAnimation for Android
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }

  componentDidMount() {
    // Cleanup is best effort at startup. File actions independently await the
    // same cleanup promise and report a safe error if native IO is unavailable.
    cleanupAbandonedExports().catch(() => {});
  }

  render() {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaProvider>
          <AppContext.Provider>
            <LanguageProvider>
              <ThemedApp />
            </LanguageProvider>
          </AppContext.Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
}

export default App;
