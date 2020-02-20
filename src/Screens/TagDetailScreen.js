import React from 'react';
import {
  View, Text, Clipboard, Alert, TouchableOpacity, ScrollView,
} from 'react-native';
import TagBanner from '../Components/TagBanner'
import NdefMessage from '../Components/NdefMessage'
import styled from 'styled-components'

class TagDetailScreen extends React.Component {
  render() {
    const { tag } = this.props.route.params;

    let ndef = null;
    if (Array.isArray(tag.ndefMessage) && tag.ndefMessage.length > 0) {
      ndef = tag.ndefMessage[0];
    }

    return (
      <View style={{ flex: 1, paddingTop: 10, alignItems: 'center'}}>
        <TagBanner tag={tag} />

        <ScrollView style={{marginTop: 10, flex: 1, alignSelf: 'stretch', padding: 10}}>
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
  margin-vertical: 5px;
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
