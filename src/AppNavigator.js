import * as React from 'react';
import {useColorScheme} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createNativeBottomTabNavigator} from '@react-navigation/bottom-tabs/unstable';
import LandingScreen from './Screens/Landing';
import HomeScreen from './Screens/Home';
import TagDetailScreen from './Screens/TagDetail';
import NdefTypeListScreen from './Screens/NdefTypeList';
import NdefWriteScreen from './Screens/NdefWrite';
import ToolKitScreen from './Screens/Toolkit';
import CustomTransceiveScreen from './Screens/CustomTransceive';
import NfcScriptEditorScreen from './Screens/NfcScriptEditor';
import NfcScriptHelpScreen from './Screens/NfcScriptHelp';
import Ntag21xMemoryScanScreen from './Screens/Ntag21xMemoryScan';
import SettingsScreen from './Screens/Settings';
import SavedRecordScreen from './Screens/SavedRecord';
import NfcPromptAndroid from './Components/NfcPromptAndroid';
import Toast from './Components/Toast';
import {PRIMARY_TABS} from './features/navigation/primaryTabs';
import {nativeTabIcon} from './features/navigation/nativeTabIcon';
import {createNavigationTheme, visualColors} from './visual/theme';

const RootStack = createNativeStackNavigator();
const HomeTabs = createNativeBottomTabNavigator();

const tabScreens = {
  HomeTab: HomeScreen,
  NdefTypeListTab: NdefTypeListScreen,
  ToolKitTab: ToolKitScreen,
  MyRecordsTab: SavedRecordScreen,
};

function HomeTabNav() {
  const colors = visualColors(useColorScheme() === 'dark');
  return (
    <HomeTabs.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarIcon: nativeTabIcon(route.name),
      })}
    >
      {PRIMARY_TABS.map(({name, title}) => (
        <HomeTabs.Screen
          key={name}
          name={name}
          component={tabScreens[name]}
          options={{title}}
        />
      ))}
    </HomeTabs.Navigator>
  );
}

function Root() {
  return (
    <RootStack.Navigator initialRouteName="Landing">
      <RootStack.Screen
        name="Landing"
        component={LandingScreen}
        options={{headerShown: false}}
      />
      <RootStack.Screen
        name="MainTabs"
        component={HomeTabNav}
        options={{headerShown: false}}
      />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{headerShown: false, presentation: 'modal'}}
      />
      <RootStack.Screen
        name="TagDetail"
        component={TagDetailScreen}
        options={{title: 'TAG DETAIL'}}
      />
      <RootStack.Screen
        name="NdefWrite"
        component={NdefWriteScreen}
        options={{headerShown: false}}
      />
      <RootStack.Screen
        name="CustomTransceive"
        component={CustomTransceiveScreen}
        options={{headerShown: false}}
      />
      <RootStack.Screen
        name="NfcScriptEditor"
        component={NfcScriptEditorScreen}
        options={{headerShown: false}}
      />
      <RootStack.Screen
        name="NfcScriptHelp"
        component={NfcScriptHelpScreen}
        options={{title: 'FLOW SCRIPT HELP'}}
      />
      <RootStack.Screen
        name="Ntag21xMemoryScan"
        component={Ntag21xMemoryScanScreen}
        options={{title: 'TYPE 2 MEMORY SCAN'}}
      />
    </RootStack.Navigator>
  );
}

function AppNavigator() {
  const isDark = useColorScheme() === 'dark';
  return (
    <NavigationContainer theme={createNavigationTheme(isDark)}>
      <Root />
      <NfcPromptAndroid />
      <Toast />
    </NavigationContainer>
  );
}

export default AppNavigator;
