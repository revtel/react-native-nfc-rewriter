import * as React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import LandingScreen from './Screens/LandingScreen';
import HomeScreen from './Screens/HomeScreen';
import TagDetailScreen from './Screens/TagDetailScreen';
import NdefWriteScreen from './Screens/NdefWriteScreen';
import CustomPayloadScreen from './Screens/CustomPayloadScreen';

const MainStack = createStackNavigator();

function Main(props) {
  return (
    <MainStack.Navigator>
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'Home'}}
      />
      <MainStack.Screen
        name="TagDetail"
        component={TagDetailScreen}
        options={{title: 'Tag Info'}}
      />
      <MainStack.Screen
        name="NdefWrite"
        component={NdefWriteScreen}
        options={{title: 'NDEF Write'}}
      />
      <MainStack.Screen
        name="CustomPayload"
        component={CustomPayloadScreen}
        options={{title: 'Custom Payload'}}
      />
    </MainStack.Navigator>
  )
}

const RootStack = createStackNavigator();

function Root(props) {
  return (
    <RootStack.Navigator headerMode="none" mode="modal">
      <RootStack.Screen name="Landing" component={LandingScreen} />
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
    </NavigationContainer>
  );
}

export default AppNavigator;
