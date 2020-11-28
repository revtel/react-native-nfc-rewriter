import * as React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import HomeScreen from './Screens/HomeScreen';
import TagDetailScreen from './Screens/TagDetailScreen';
import NdefWriteScreen from './Screens/NdefWriteScreen';
import CustomPayloadScreen from './Screens/CustomPayloadScreen';

const Stack = createStackNavigator();

function AppNavigator(props) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'Home'}}
        />
        <Stack.Screen
          name="TagDetail"
          component={TagDetailScreen}
          options={{title: 'Tag Info'}}
        />
        <Stack.Screen
          name="NdefWrite"
          component={NdefWriteScreen}
          options={{title: 'NDEF Write'}}
        />
        <Stack.Screen
          name="CustomPayload"
          component={CustomPayloadScreen}
          options={{title: 'Custom Payload'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
