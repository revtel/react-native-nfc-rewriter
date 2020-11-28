import React from 'react';
import {
  View, Text, Clipboard, Alert, ScrollView, Platform, Dimensions,
} from 'react-native';
import {Button} from 'react-native-paper';
import TagBanner from '../Components/TagBanner'
import NdefMessage from '../Components/NdefMessage'
import styled from 'styled-components'
import {getTechList} from '../Utils/getTechList';
import * as Widget from '../Components/Widget';
import {NfcTech} from 'react-native-nfc-manager';

const NFCA_OR_MIFARE_TECH = Platform.OS === 'android' ? 'NfcA' : 'mifare';

class TagDetailScreen extends React.Component {
  render() {
    const {navigation} = this.props;
    const { tag } = this.props.route.params;

    let ndef = null;
    if (Array.isArray(tag.ndefMessage) && tag.ndefMessage.length > 0) {
      ndef = tag.ndefMessage[0];
    }

    let techs = getTechList(tag);

    const padding = 20;
    let bannerWidth = Dimensions.get('window').width - 2 * padding;

    return (
      <View style={{ flex: 1, padding, alignItems: 'center', backgroundColor: 'white'}}>
        <TagBanner tag={tag} width={bannerWidth} />

        <ScrollView style={{marginTop: 10, flex: 1, alignSelf: 'stretch', paddingTop: 10}}>
          {techs.findIndex(tech => tech === NFCA_OR_MIFARE_TECH) > -1 && (
            <Button
              mode='outlined'
              labelStyle={{color: '#666'}}
              onPress={() => navigation.navigate(
                'CustomPayload', 
                { 
                  tag,
                  techType: Platform.OS === 'android' ? NfcTech.NfcA : NfcTech.MifareIOS,
                }
              )}
            >
              NFCA / Mifare COMMAND
            </Button>
          ) || null}

          <SectionLabel>
            <SectionLabelText>NDEF</SectionLabelText>
          </SectionLabel>

          {ndef ? (
            <NdefMessage ndef={ndef} />
          ) : (
            <Text>None</Text>
          )}

          <SectionLabel>
            <SectionLabelText>TAG INFO</SectionLabelText>
            <ClickToCopyBtn onPress={this._copyTagInfo}>
              <Text style={{fontSize: 14, color: 'grey'}}>Copy to clipboard</Text>
            </ClickToCopyBtn>
          </SectionLabel>

          <Text>{JSON.stringify(tag, null, 4)}</Text>
        </ScrollView>
      </View>
    )
  }

  _copyTagInfo = () => {
    const { tag } = this.props.route.params;
    Clipboard.setString(JSON.stringify(tag, null, 2));
    Alert.alert('Copied to clipboard!');
  }
}

const SectionLabel = styled.View`
  border-bottom-width: 2px;
  border-bottom-color: gray;
  color: grey;
  padding: 8px;
  flex-direction: row;
  align-items: center;
  margin-vertical: 20px;
`;

const SectionLabelText = styled.Text`
  color: gray;
  font-size: 20px;
`;

const ClickToCopyBtn = styled.TouchableOpacity`
  margin-left: 10px;
  padding-vertical: 3px;
  padding-horizontal: 6px;
  border-radius: 12px;
  border-width: 1px;
  border-color: grey;
`;

export default TagDetailScreen;
