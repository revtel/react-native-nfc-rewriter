import * as React from 'react';
import {Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeBottomTabNavigator} from '@react-navigation/bottom-tabs/unstable';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
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
import * as Theme from './Theme';

const RootStack = createNativeStackNavigator();
// Android native tabs currently clip the system status bar on cutout devices.
// Keep native tabs on iOS and use the stable tab view on Android.
const HomeTabs =
  Platform.OS === 'ios'
    ? createNativeBottomTabNavigator()
    : createBottomTabNavigator();

const tabScreens = {
  HomeTab: HomeScreen,
  NdefTypeListTab: NdefTypeListScreen,
  ToolKitTab: ToolKitScreen,
  MyRecordsTab: SavedRecordScreen,
};

function tabIcon(routeName) {
  const names = PRIMARY_TABS.find(({name}) => name === routeName)?.icons;
  if (!names) {
    return undefined;
  }
  if (Platform.OS === 'android') {
    return ({color, size}) => (
      <MaterialIcons name={names.android} size={size} color={color} />
    );
  }
  return {type: 'sfSymbol', name: names.ios};
}

function HomeTabNav() {
  return (
    <HomeTabs.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.blue,
        tabBarIcon: tabIcon(route.name),
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
  return (
    <NavigationContainer>
      <Root />
      <NfcPromptAndroid />
      <Toast />
    </NavigationContainer>
  );
}

export default AppNavigator;
