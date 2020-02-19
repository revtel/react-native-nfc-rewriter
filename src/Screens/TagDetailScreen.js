import React from 'react';
import {
  View, Text, Clipboard, Alert, TouchableOpacity, ScrollView,
} from 'react-native';
import TagItem from '../Components/TagItem'

class TagDetailScreen extends React.Component {
  render() {
    const { tag } = this.props.route.params;
    return (
      <View style={{ flex: 1, paddingTop: 10, alignItems: 'center'}}>
        <TagItem card={tag} />

        <ScrollView style={{marginTop: 10, flex: 1, alignSelf: 'stretch', padding: 10}}>
          <Text style={{fontSize: 20}}>Tag Detail</Text>
          <Text style={{fontSize: 12, color: 'grey'}}>* long press to copy</Text>
          <TouchableOpacity 
            style={{marginTop: 10}}
            onLongPress={this._copyTagInfo}
          >
            <Text>{JSON.stringify(tag, null, 2)}</Text>
          </TouchableOpacity>
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

export default TagDetailScreen;
