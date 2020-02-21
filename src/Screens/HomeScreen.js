import * as React from 'react';
import { View } from 'react-native';
import NfcProxy from '../NfcProxy';
import styled from 'styled-components';

function HomeScreen({navigation}) {
  return (
    <View style={{flex: 1, padding: 20}}>
      <View style={{flex: 1, justifyContent: 'center'}}>
        <LogoImage source={require('../../images/nfc-512.png')}/>
      </View>

      <View style={{flex: 1, alignItems: 'center'}}>
        <ActionBtn
          onPress={async () => {
            const tag = await NfcProxy.readTag();
            if (tag) {
              navigation.navigate('TagDetail', {tag});
            }
          }}
        >
          <ActionBtnText>Scan NFC Tag</ActionBtnText>
        </ActionBtn>

        <ActionBtn
          onPress={async () => {
            navigation.navigate('NdefWrite');
          }}
        >
          <ActionBtnText>Write NFC Tag</ActionBtnText>
        </ActionBtn>
      </View>

    </View>
  );
}

const LogoImage = styled.Image`
  width: 200px;
  height: 200px;
  alignSelf: center;
`;

const ActionBtn = styled.TouchableOpacity`
  padding-vertical: 6px;
  padding-horizontal: 10px;
  border-radius: 20px;
  border-width: 1px;
  border-color: black;
  min-width: 240px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: white;
  margin-bottom: 10px;
`;

const ActionBtnText = styled.Text`
  font-size: 22px;
`;

export default HomeScreen;