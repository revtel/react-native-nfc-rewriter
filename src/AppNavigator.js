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
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Theme from './Theme';

const RootStack = createStackNavigator();
const MainStack = createStackNavigator();
const HomeTabs = createBottomTabNavigator();

function HomeTabNav() {
  return (
    <HomeTabs.Navigator
      screenOptions={({route}) => {
        const focusedName = getFocusedRouteNameFromRoute(route);
        const extraProps = {};
        if (focusedName !== undefined) {
          if (focusedName !== 'Home' && focusedName !== 'Assistant') {
            extraProps.tabBarStyle = {height: 0, display: 'none'};
          }
        }

        return {
          tabBarIcon: ({focused, color, size}) => {
            let iconName;

            if (route.name === 'HomeTab') {
              iconName = 'nfc-search-variant';
            } else if (route.name === 'NdefTypeListTab') {
              iconName = 'database-edit';
            } else if (route.name === 'ToolKitTab') {
              iconName = 'tools';
            } else if (route.name === 'MyRecordsTab') {
              iconName = 'archive-star';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
          headerShown: false,
          tabBarActiveTintColor: Theme.colors.blue,
          tabBarInactiveTintColor: 'gray',
          ...extraProps,
        };
      }}>
      <HomeTabs.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{tabBarLabel: 'SCAN TAG'}}
      />
      <HomeTabs.Screen
        name="NdefTypeListTab"
        component={NdefTypeListScreen}
        options={{title: 'WRITE NDEF'}}
      />
      <HomeTabs.Screen
        name="ToolKitTab"
        component={ToolKitScreen}
        options={{title: 'TOOLKIT'}}
      />
      <HomeTabs.Screen
        name="MyRecordsTab"
        component={SavedRecordScreen}
        options={{title: 'MY RECORDS'}}
      />
    </HomeTabs.Navigator>
  );
}

function Main(props) {
  return (
    <MainStack.Navigator
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
        name="TagDetail"
        options={{title: 'TAG DETAIL'}}
        component={TagDetailScreen}
      />
      <MainStack.Screen
        name="NdefWrite"
        component={NdefWriteScreen}
        options={{title: 'WRITE NDEF'}}
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

function Root(props) {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
      }}>
      <RootStack.Screen name="Landing" component={LandingScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
      <RootStack.Screen name="Main" component={Main} />
      <RootStack.Screen
        name="MainTabs"
        component={HomeTabNav}
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
