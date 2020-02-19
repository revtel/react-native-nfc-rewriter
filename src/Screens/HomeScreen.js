import * as React from 'react';
import { View, Image } from 'react-native';
import { Button } from 'react-native-elements';
import NfcProxy from '../NfcProxy';

function HomeScreen({navigation}) {
  return (
    <View style={{flex: 1, padding: 20}}>
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Image
          style={{
            width: 200,
            height: 200,
            alignSelf: 'center',
          }}
          source={require('../../images/nfc-512.png')}
        />
      </View>

      <View style={{flex: 1}}>
        <Button
          title="Scan Tag"
          style={{alignSelf: 'center', width: 240}}
          onPress={async () => {
            try {
              const tag = await NfcProxy.readTag();
              navigation.navigate('TagDetail', {tag});
            } catch (ex) {
              console.warn('readTag ex', ex);
            }
            await NfcProxy.abort();
          }}
        />

        <Button
          title="Write Tag"
          style={{alignSelf: 'center', width: 240, marginTop: 15}}
          onPress={async () => {
          }}
        />
      </View>

    </View>
  );
}

export default HomeScreen;