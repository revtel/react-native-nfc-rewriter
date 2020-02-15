import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import NfcProxy from '../NfcProxy';

function HomeScreen({navigation}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Button 
        title="Scan Tag" 
        onPress={
          async () => {
            try {
              const tag = await NfcProxy.readTag();
              navigation.navigate('TagDetail', { tag });
            } catch (ex) {
              console.warn('readTag ex', ex);
            }
            await NfcProxy.abort();
          }
        }
      />
    </View>
  );
}

export default HomeScreen;