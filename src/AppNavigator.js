import * as React from 'react';
import {Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {
  createStackNavigator,
  CardStyleInterpolators,
} from '@react-navigation/stack';
import {Appbar} from 'react-native-paper';
import LandingScreen from './Screens/Landing';
import HomeScreen from './Screens/Home';
import TagDetailScreen from './Screens/TagDetail';
import NdefTypeListScreen from './Screens/NdefTypeList';
import NdefWriteScreen from './Screens/NdefWrite';
import ToolKitScreen from './Screens/Toolkit';
import TagKitScreen from './Screens/TagKit';
import CustomTransceiveScreen from './Screens/CustomTransceive';
import SettingsScreen from './Screens/Settings';
import SavedRecordScreen from './Screens/SavedRecord';
import NfcPromptAndroid from './Components/NfcPromptAndroid';
import Toast from './Components/Toast';

const MainStack = createStackNavigator();

function Main(props) {
  return (
    <MainStack.Navigator
      headerMode="screen"
      screenOptions={{
        header: (headerProps) => {
          const {navigation, back, options, route} = headerProps;
          const excludedScreens = ['Home', 'NdefWrite', 'CustomTransceive'];

          if (excludedScreens.findIndex((name) => name === route?.name) > -1) {
            return null;
          }

          return (
            <Appbar.Header style={{backgroundColor: 'white'}}>
              {back && (
                <Appbar.BackAction onPress={() => navigation.goBack()} />
              )}
              <Appbar.Content title={options?.title || ''} />
            </Appbar.Header>
          );
        },
      }}>
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'HOME'}}
      />
      <MainStack.Screen
        name="TagDetail"
        options={{title: 'TAG DETAIL'}}
        component={TagDetailScreen}
      />
      <MainStack.Screen
        name="NdefTypeList"
        component={NdefTypeListScreen}
        options={{title: 'CHOOSE NDEF TYPE'}}
      />
      <MainStack.Screen
        name="NdefWrite"
        component={NdefWriteScreen}
        options={{title: 'WRITE NDEF'}}
      />
      <MainStack.Screen
        name="ToolKit"
        component={ToolKitScreen}
        options={{title: 'NFC TOOL KIT'}}
      />
      <MainStack.Screen
        name="TagKit"
        component={TagKitScreen}
        options={{title: 'NFC TAG KIT'}}
      />
      <MainStack.Screen
        name="CustomTransceive"
        component={CustomTransceiveScreen}
        options={{title: 'CUSTOM TRANSCEIVE'}}
      />
      <MainStack.Screen
        name="SavedRecord"
        component={SavedRecordScreen}
        options={{title: 'MY SAVED RECORDS'}}
      />
    </MainStack.Navigator>
  );
}

const SettingsStack = createStackNavigator();

function Settings(props) {
  return (
    <SettingsStack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        header: (headerProps) => {
          const {navigation, back, options, route} = headerProps;
          return (
            <>
              <Appbar.Header
                style={{
                  backgroundColor: 'white',
                  marginTop: Platform.OS === 'ios' ? 40 : 0,
                }}>
                {back && (
                  <Appbar.BackAction onPress={() => navigation.goBack()} />
                )}
                <Appbar.Content title={options.title || ''} />
              </Appbar.Header>
            </>
          );
        },
      }}>
      <SettingsStack.Screen
        name="Settings"
        options={{title: 'Settings'}}
        component={SettingsScreen}
      />
    </SettingsStack.Navigator>
  );
}

const RootStack = createStackNavigator();

function Root(props) {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
      }}>
      <RootStack.Screen name="Landing" component={LandingScreen} />
      <RootStack.Screen name="Settings" component={Settings} />
      <RootStack.Screen
        name="Main"
        component={Main}
        options={{animationEnabled: false}}
      />
    </RootStack.Navigator>
  );
}

function AppNavigator(props) {
  return (
    <NavigationContainer>
      <Root />
      <NfcPromptAndroid />
      <Toast />
    </NavigationContainer>
  );
}

export default AppNavigator;
