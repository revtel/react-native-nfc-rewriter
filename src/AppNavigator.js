import * as React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {Appbar} from 'react-native-paper';
import LandingScreen from './Screens/LandingScreen';
import HomeScreen from './Screens/HomeScreen';
import TagDetailScreen from './Screens/TagDetailScreen';
import NdefTypeListScreen from './Screens/NdefTypeListScreen';
import NdefWriteScreen from './Screens/NdefWriteScreen';
import CustomPayloadScreen from './Screens/CustomPayloadScreen';

const MainStack = createStackNavigator();

function Main(props) {
  return (
    <MainStack.Navigator
      headerMode="screen"
      screenOptions={{
        header: ({navigation, scene, previous}) => {
          const excludedScreens = ['Home'];

          if (
            excludedScreens.findIndex((name) => name === scene?.route?.name) >
            -1
          ) {
            return null;
          }

          return (
            <Appbar.Header style={{backgroundColor: 'white'}}>
              {previous && (
                <Appbar.BackAction onPress={() => navigation.goBack()} />
              )}
              <Appbar.Content title={scene.descriptor.options.title || ''} />
            </Appbar.Header>
          );
        },
      }}>
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'HOME'}}
      />
      <MainStack.Screen name="TagDetail" component={TagDetailScreen} />
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
        name="CustomPayload"
        component={CustomPayloadScreen}
        options={{title: 'CUSTOM PAYLOAD'}}
      />
    </MainStack.Navigator>
  );
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
