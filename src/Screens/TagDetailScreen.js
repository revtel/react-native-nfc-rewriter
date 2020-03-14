import React from 'react';
import {
  View, Text, Clipboard, Alert, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
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

    return (
      <View style={{ flex: 1, paddingTop: 10, alignItems: 'center'}}>
        <TagBanner tag={tag} />

        <ScrollView style={{marginTop: 10, flex: 1, alignSelf: 'stretch', padding: 10}}>
          {techs.findIndex(tech => tech === NFCA_OR_MIFARE_TECH) > -1 && (
            <Widget.ActionBtn
              onPress={() => navigation.navigate(
                'CustomPayload', 
                { 
                  tag,
                  techType: Platform.OS === 'android' ? NfcTech.NfcA : NfcTech.MifareIOS,
                }
              )}
            >
              <Widget.ActionBtnText>Custom NFCA / Mifare Command</Widget.ActionBtnText>
            </Widget.ActionBtn>
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
            <SectionLabelText>Tag Detail</SectionLabelText>
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
  border-left-width: 10px;
  border-left-color: grey;
  padding: 6px;
  flex-direction: row;
  align-items: center;
  margin-vertical: 10px;
`;

const SectionLabelText = styled.Text`
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
