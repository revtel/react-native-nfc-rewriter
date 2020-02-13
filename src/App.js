// import AppIndexV2 from 'react-native-nfc-manager/example/AppIndexV2'
import * as React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Button, ThemeProvider } from 'react-native-elements';

function HomeScreen({navigation}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Button 
        title="To Detail" 
        onPress={() => navigation.navigate('detail')}
      />
    </View>
  );
}

function DetailScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Details Screen</Text>
    </View>
  );
}

const Stack = createStackNavigator();

function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="home" component={HomeScreen} options={{ title: 'Home' }}/>
          <Stack.Screen name="detail" component={DetailScreen} options={{ title: 'Detail' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

export default App;