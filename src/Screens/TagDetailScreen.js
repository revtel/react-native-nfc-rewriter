import React from 'react';
import {
  View, Text
} from 'react-native';

class TagDetailScreen extends React.Component {
  render() {
    const { tag } = this.props.route.params;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 }}>
        <Text>{JSON.stringify(tag, null, 2)}</Text>
      </View>
    )
  }
}

export default TagDetailScreen;
