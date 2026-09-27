import './AppOutlets';
import * as React from 'react';
import {Platform, UIManager, useColorScheme} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import AppNavigator from './AppNavigator';
import * as AppContext from './AppContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {createPaperTheme} from './visual/theme';

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

  render() {
    return (
      <SafeAreaProvider>
        <AppContext.Provider>
          <ThemedApp />
        </AppContext.Provider>
      </SafeAreaProvider>
    );
  }
}

export default App;
