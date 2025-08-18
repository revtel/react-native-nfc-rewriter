import './AppOutlets';
import * as React from 'react';
import {Platform, UIManager} from 'react-native';
import {MD3LightTheme as DefaultTheme, PaperProvider} from 'react-native-paper';
import AppNavigator from './AppNavigator';
import * as AppContext from './AppContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3985cb',
    secondary: 'yellow',
  },
};

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
          <PaperProvider theme={theme}>
            <AppNavigator />
          </PaperProvider>
        </AppContext.Provider>
      </SafeAreaProvider>
    );
  }
}

export default App;
